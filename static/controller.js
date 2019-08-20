'use strict';

var mopidy = null;

// TODO : add a mopidy service designed for angular, to avoid ugly $scope.$apply()...
angular.module('partyApp', [])
  .controller('MainController', function($scope) {

  // Scope variables
  $scope.message = [];
  $scope.tracks  = [];
  $scope.tracksToLookup = [];
  $scope.maxTracksToLookupAtOnce = 50;
  $scope.loading = true;
  $scope.ready   = false;
  $scope.isPlaying = false;
  $scope.volume = 50;
  $scope.history = [];
  $scope.ranking = [];
  $scope.tempTrack = null;
  $scope.currentState = {
    paused : false,
    length : 0,
    track  : {
      length : 0,
      name   : 'Nothing playing, add some songs to get the party going!'
    }
  };

  var updateHistory= function(isPlaying = false) {
    try {
        //keep the italian coding style!:
        mopidy.history.getHistory()
        .then(function(responese) {
    	     $scope.history = responese.map(entry => entry[1].name);
             if(isPlaying) {
                 $scope.history = $scope.history.slice(1);
             }
	     $scope.history = $scope.history.slice(0, 4);
	     console.log($scope.history);
        });

        $scope.getRanking();
    } catch(ignored) {
        console.log("Error:");
        console.log(ignored);
        $scope.history = ["Äns"];
    }
  }

  // Initialize
  mopidy = new Mopidy({
    'callingConvention' : 'by-position-or-by-name'
  });

  var updateGUI = function() {
    mopidy.playback.getState()
    .then(function(state) {
      var volume_changed = false;
      if(state === 'stopped') {
        if($scope.tempTrack != null) {
          console.log("Playback is stopped!");
          updateHistory(false);
          $scope.currentState.track.name = 'Nothing playing, add some songs to get the party going!';
          $scope.currentState.track.artists = '';
          $scope.currentState.track.length = 0;
          $scope.currentState.length = 0;
          $scope.currentState.paused = false;
          $scope.tempTrack = null;
          $scope.message = '';
        }
      } else if (state === 'playing') {
        mopidy.playback.getCurrentTrack()
        .then(function(track) {
          if($scope.tempTrack == null || ($scope.tempTrack.uri != track.uri)) {
            console.log("Playback is started!");
            updateHistory(true);
            $scope.tempTrack = track;
            $scope.currentState.track = track;
            $scope.currentState.paused = false;
            $scope.message = '';

            mopidy.tracklist.getLength()
            .then(function(length) {
              $scope.currentState.length = length;
            });
          }

          if($scope.currentState.paused == true) {
            $scope.ready = $scope.playable();
            $scope.currentState.paused = false;
          }
        });
      } else if (state === 'paused'){
        if($scope.currentState.paused != true) {
          console.log("Playback is paused!");
          $scope.currentState.paused = true;
          $scope.ready = $scope.playable();
        } 
      } else {
        console.log("Invalid Playback State!");
      }

      var slider = document.getElementById("myRange");
      var actVol = $scope.getVolume();
      
      if(slider.value != $scope.volume) {
        console.log("You have changed to Volume!");
        $scope.volume = slider.value;
        $scope.setVolume();
      } else {
        console.log("Another has changed the Volume!");
        slider.value = actVol;
        $scope.volume = actVol;
      }

      $scope.$apply();
    });
  }

  // Adding listenners
  mopidy.on('state:online', function () {
    updateHistory(false);
    mopidy.playback
    .getCurrentTrack()
    .then(function(track){
      if(track) {
        $scope.currentState.track = track;
        updateHistory(true);
      }

      return mopidy.playback.getState();
    })
    .then(function(state){
      $scope.currentState.paused = (state === 'paused');
      return mopidy.tracklist.getLength();
    })
    .then(function(length){
      $scope.currentState.length = length;
    })
    .done(function(){
      var slider = document.getElementById("myRange");
      $scope.volume = $scope.getVolume();
      slider.value = $scope.volume;
      $scope.ready = $scope.playable();
      $scope.loading = false;
      $scope.$apply();
      $scope.search();
      console.log($scope.volume);
    });

    setInterval(function(){
        updateGUI();
    }, 1000);

  });

  $scope.printDuration = function(track){

    if(!track.length)
      return '';

    var _sum = parseInt(track.length / 1000);
    var _min = parseInt(_sum / 60);
    var _sec = _sum % 60;

    return '(' + _min + ':' + (_sec < 10 ? '0' + _sec : _sec) + ')' ;
  };

  $scope.togglePause = function(){
    var _fn = $scope.currentState.paused ? mopidy.playback.resume : mopidy.playback.pause;
    _fn().done();
  };

  $scope.search = function(){

    $scope.message = [];
    $scope.loading = true;

    if(!$scope.searchField) {
      mopidy.library.browse({
        'uri' : 'local:directory'
      }).done($scope.handleBrowseResult);
      return;
    }

    mopidy.library.search({
      'any' : [$scope.searchField]
    }).done($scope.handleSearchResult);
  };

  $scope.handleBrowseResult = function(res){

    $scope.loading = false;
    $scope.tracks  = [];
    $scope.tracksToLookup = [];

    for(var i = 0; i < res.length; i++){
      if(res[i].type == 'directory' && res[i].uri == 'local:directory?type=track'){
        mopidy.library.browse({
          'uri' : res[i].uri
        }).done($scope.handleBrowseResult);
      } else if(res[i].type == 'track'){
        $scope.tracksToLookup.push(res[i]);
      }
    }

    if($scope.tracksToLookup) {
      $scope.lookupOnePageOfTracks();
    }
  }

  $scope.lookupOnePageOfTracks = function(){

    var _index = 0;
    while(_index < $scope.maxTracksToLookupAtOnce && $scope.tracksToLookup){

      var track = $scope.tracksToLookup.shift();
      if(track){
        mopidy.library.lookup({'uri' : track.uri}).done(function(tracklist){
        for(var j = 0; j < tracklist.length; j++){
          $scope.addTrackResult(tracklist[j]);
        }
        $scope.$apply();
        });
      }
      _index++;
    }
  };

  $scope.handleSearchResult = function(res){

    $scope.loading = false;
    $scope.tracks  = [];

    var _index = 0;
    var _found = true;
    while(_found){
      _found = false;
      for(var i = 0; i < res.length; i++){
        if(res[i].tracks && res[i].tracks[_index]){
          $scope.addTrackResult(res[i].tracks[_index]);
          _found = true;
        }
      }
      _index++;
    }

    $scope.$apply();
  };

  $scope.addTrackResult = function(track){

    $scope.tracks.push(track);
    mopidy.tracklist.filter({'uri': [track.uri]}).done(
      function(matches){
        if (matches.length) {
          for (var i = 0; i < $scope.tracks.length; i++)
          {
            if ($scope.tracks[i].uri == matches[0].track.uri)
              $scope.tracks[i].disabled = true;
          }
          $scope.$apply();
        }
      });
  };

  $scope.addTrack = function(track){

    track.disabled = true;

    mopidy.tracklist
    .index()
    .then(function(index){
      return mopidy.tracklist.add({uris: [track.uri]});
    })
    .then(function(){
      // Notify user
      $scope.message = ['success', 'Next track: ' + track.name];
      $scope.$apply();

      return mopidy.tracklist.setConsume([true]);
    })
    .then(function(){
      return mopidy.playback.getState();
    })
    .then(function(state){
      // Get current state
      if(state !== 'stopped')
        return;
      // If stopped, start music NOW!
      return mopidy.playback.play();
    })
    .catch(function(){
      track.disabled = false;
      $scope.message = ['error', 'Unable to add track, please try again...'];
      $scope.$apply();
    })
    .done();
  };

  $scope.playable = function(){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", "/party/playable", false );
    xmlHttp.send( null );

    var data = JSON.parse(xmlHttp.responseText)
    return data._isPlayable;
  }

  $scope.mute = function(){
    $scope.setMute();

    setTimeout(function(){
        $scope.setMute();
    }, 18000000);
  }

  $scope.setMute = function() {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", "/party/mute", false );
    xmlHttp.send( null );
    $scope.message = ['success', xmlHttp.responseText];
  }

  $scope.setVolume = function() {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "POST", "/party/volume", false);

    var data = new FormData();
    data.append('_Volume', $scope.volume);
    xmlHttp.send(data);
  }

  $scope.getVolume = function() {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", "/party/volume", false);
    xmlHttp.send( null );

    var data = JSON.parse(xmlHttp.responseText)
    return data._Volume;
  }

  $scope.nextTrack = function(){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", "/party/vote", false ); // false for synchronous request
    xmlHttp.send( null );
    $scope.message = ['success', xmlHttp.responseText];
    $scope.$apply();
  };

  $scope.superlike = function() {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", "/party/like", false ); // false for synchronous request
    xmlHttp.send( null );
    $scope.message = ['success', xmlHttp.responseText];
    $scope.$apply();
  };

  $scope.getRanking = function(){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", "/party/rank", false ); // false for synchronous request
    xmlHttp.send( null );
    var rankingList = JSON.parse(xmlHttp.responseText)
    console.log(rankingList);
    $scope.ranking = rankingList.map(elem => elem.artist + " - " + elem.songName + " ["+elem.playCount+"]");
  };
});
