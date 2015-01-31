$(function() {
  
  var Stadium = function(data) {
    this.name = ko.observable(data.name);
    this.lat = ko.observable(data.lat);
    this.lng = ko.observable(data.lng);
    this.visible = typeof data.visible === 'boolean' ? 
                    ko.observable(data.visible) : ko.observable(true);
    /* 
       Returns the location in a format that's useful for
       Google Maps.
     */
    this.mapPoint = ko.computed(function() {
      return { 
              'lat': this.lat(), 
              'lng': this.lng() 
             };
    }, this);
    
    /*
       Returns a Google maps marker options object literal for the stadium.
    */
    this.marker = ko.computed(function() {
      return {
               position: this.mapPoint(),
               title: this.name()
             }
    }, this);
  };
  
  var stadiumData = [
    { 'name': 'Turner Field',
      'lat':  33.735278,
      'lng': -84.389444
    },
    {
      'name': 'Target Field',
      'lat': 44.981667, 
      'lng': -93.278333
    },
    {
      'name': 'O.co Coliseum',
      'lat': 37.751667,
      'lng': -122.200556
    }
  ];
  
  var ViewModel = function() {
    var self = this;
    
    this.stadiums = ko.observableArray([]);
    for (var stadium in stadiumData) {
      this.stadiums.push(new Stadium(stadiumData[stadium]));
    }
  };
  
  ko.bindingHandlers.googlemap = {
    init: function(element, valueAccessor) {
      var value = valueAccessor;
      var mapOptions = {
        zoom: 4,
        center: { lat: 39.8282, lng: -98.5795 },
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.SMALL,
            position: google.maps.ControlPosition.RIGHT_BOTTOM
        },
      };
      var map = new google.maps.Map(element, mapOptions);
      
      for (var i in value().stadiums()) {
        var stadium = value().stadiums()[i];
        if (stadium.visible()) {
          var marker = new google.maps.Marker(stadium.marker());
          marker.setMap(map);
        }

      }
            
      /*
        When the tiles are loaded, we detach all the KO views and reattach
        them as map controls. This way we get all the goodness of map controls
        but don't have to worry about when to ko.applyBinding.
      */
      google.maps.event.addListener(map, 'tilesloaded', function(evt) {
        var control = document.createElement('div');
        control.id = 'stadium-list-control';
        var list = $('#stadium-list').detach();
        map.controls[google.maps.ControlPosition.TOP_RIGHT].push(control);
        list.appendTo('#stadium-list-control')
      });
    }
  };
  
  ko.applyBindings(new ViewModel());
});