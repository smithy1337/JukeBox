$(document).ready(function()
{
    var body = $(document.body);

    $('#backgrounds').bind('change', function(event){
        var bg = $(this).val();
        if(bg == null || typeof bg === 'undefined' || $.trim(bg) === '') {
            body.css('background-image', '');
        } else {
            body.css('background-image', "url('" + bg + "')");
            window.localStorage.setItem('jukebox_bg', $("#backgrounds :selected").val());
        }
    });

    var selection = window.localStorage.getItem('jukebox_bg')
    console.log(selection);
    if(selection != null) {
        body.css('background-image', "url('" + selection + "')");
        $('#backgrounds').val(selection);
    }
});