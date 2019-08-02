from __future__ import absolute_import, unicode_literals

import os

import tornado.web

from mopidy import config, ext

__version__ = '0.3.1'

_requiredVotes = 3
def setRequiredVotes(votes):
    global _requiredVotes
    _requiredVotes = votes

def getRequiredVotes():
    return _requiredVotes

class PartyVoteHandler(tornado.web.RequestHandler):

    def initialize(self, core, data, config):
	self.config = config
        self.core = core
        self.data = data
	
    def get(self):
        currentTrack = self.core.playback.get_current_track().get()
        if (currentTrack == None): return
        currentTrackURI = currentTrack.uri

        # If the current track is different to the one stored, clear votes
        if (currentTrackURI != self.data["track"]):
            self.data["track"] = currentTrackURI
            self.data["votes"] = []
	    setRequiredVotes(3)

        if (self.request.remote_ip in self.data["votes"]): # User has already voted
            self.write("You have already voted to skip this song =)")
        else: # Valid vote
            self.data["votes"].append(self.request.remote_ip)
            if (len(self.data["votes"]) == getRequiredVotes()):
                self.core.playback.next()
                self.write("Skipping...")
            else:
                self.write("You have voted to skip this song. ("+str(getRequiredVotes() - len(self.data["votes"]))+" more votes needed)")

	print(("People voted: %d") % (len(self.data["votes"])))
        print(("Votes after Skip: %d") % (getRequiredVotes()))



class PartyLikeHandler(tornado.web.RequestHandler):
	
    def initialize(self, core, data, config):
        self.config = config
        self.core = core
        self.data = data

    def get(self):
        currentTrack = self.core.playback.get_current_track().get()
        if (currentTrack == None): return
        currentTrackURI = currentTrack.uri

        # If the current track is different to the one stored, clear votes
        if (currentTrackURI != self.data["track"]):
            self.data["track"] = currentTrackURI
            self.data["likes"] = []
	    setRequiredVotes(3)

        if (self.request.remote_ip in self.data["likes"]): # User has already liked
            self.write("You have already liked this song =)")
        else: # Valid vote
            self.data["likes"].append(self.request.remote_ip)
            setRequiredVotes((getRequiredVotes() + 1))
            self.write("You have liked this song! <3")

	print(("People liked: %d") % (len(self.data["likes"])))
        print(("Votes after Like: %d") % (getRequiredVotes()))

def party_factory(config, core):
    data = {'track':"", 'votes':[], 'likes':[]}
    return [
    ('/vote', PartyVoteHandler, {'core': core, 'data':data, 'config':config}),
    ('/like', PartyLikeHandler, {'core': core, 'data':data, 'config':config})
    ]


class Extension(ext.Extension):

    dist_name = 'Mopidy-Party'
    ext_name = 'party'
    version = __version__

    def get_default_config(self):
        conf_file = os.path.join(os.path.dirname(__file__), 'ext.conf')
        return config.read(conf_file)

    def get_config_schema(self):
        schema = super(Extension, self).get_config_schema()
        schema['votes_to_skip'] = config.Integer(minimum=0)
        return schema

    def setup(self, registry):
        registry.add('http:static', {
            'name': self.ext_name,
            'path': os.path.join(os.path.dirname(__file__), 'static'),
        })
        registry.add('http:app', {
            'name': self.ext_name,
            'factory': party_factory,
        })
