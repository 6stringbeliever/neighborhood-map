$(function() {

  var Stadium = function(data) {
    this.name = ko.observable(data.name);
    this.lat = ko.observable(data.lat);
    this.lng = ko.observable(data.lng);
    /* Default visible to true unless it's set in the passed in data */
    this.visible = typeof data.visible === 'boolean' ?
                    ko.observable(data.visible) : ko.observable(true);

    this.teams = ko.observableArray([]);

    for (var i = 0; i < data.teams.length; i++) {
      this.teams.push({'name': ko.observable(data.teams[i].name),
                       'sport': ko.observable(data.teams[i].sport),
                       'league': ko.observable(data.teams[i].league)});
    }

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
       Returns a Google maps marker for the stadium.
    */
    this.marker = ko.observable(new google.maps.Marker({
               position: this.mapPoint(),
               title: this.name()
             }));
  };

  var stadiumData = [
    { 'name': 'Turner Field',
      'lat':  33.735278,
      'lng': -84.389444,
      'teams': [{ 'name': 'Atlanta Braves',
                  'sport': 'baseball',
                  'league': 'MLB' }]
    },
    {
      'name': 'Target Field',
      'lat': 44.981667,
      'lng': -93.278333,
      'teams': [{ 'name': 'Minnesota Twins',
                  'sport': 'baseball',
                  'league': 'MLB' }]
    },
    {
      'name': 'O.co Coliseum',
      'lat': 37.751667,
      'lng': -122.200556,
      'teams': [{ 'name': 'Oakland Athletics',
                  'sport': 'baseball',
                  'league': 'MLB' },
                { 'name': 'Oakland Raiders',
                  'sport': 'football',
                  'league': 'NFL'}]
    }
  ];

  var ViewModel = function() {
    var self = this;

    self.map = null;

    self.infowindow = new google.maps.InfoWindow(
        { content: '<div id="info-window"></div>' });

    self.stadiums = ko.observableArray([]);
    for (var stadium in stadiumData) {
      self.stadiums.push(new Stadium(stadiumData[stadium]));
    }

    self.selectedStadium = ko.observable(null);

    self.showMarker = function(stadium) {
      console.log("Clicked " + stadium.name());
      try {
        self.infowindow.close();
      } catch (e) {
        console.log(e);
      }
    };
  };

  ko.bindingHandlers.googlemap = {
    /*
      On init, create the map and attach the map controls.
    */
    init: function(element, valueAccessor, allBindings,
                    viewModel, bindingContext) {
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
      var ctx = bindingContext;

      ctx.$data.map = new google.maps.Map(element, mapOptions);

      /*
        When the tiles are loaded, we detach all the KO views and reattach
        them as map controls. This way we get all the goodness of map controls
        but don't have to worry about when to ko.applyBinding.
      */
      google.maps.event.addListener(ctx.$data.map, 'tilesloaded', function(e) {
        var control = document.createElement('div');
        control.id = 'stadium-list-control';
        var list = $('#stadium-list').detach();
        ctx.$data.map.controls[google.maps.ControlPosition.TOP_RIGHT]
                                                              .push(control);
        list.appendTo('#stadium-list-control');
      });
    },

    /*
      On update, cycle through the stadium list passed through valueAccessor and
      display all markers set to visible.
    */
    update: function(element, valueAccessor, allBindings,
                      viewModel, bindingContext) {
      var value = valueAccessor;
      var ctx = bindingContext;

      for (var i in value().stadiums()) {
        var stadium = value().stadiums()[i];
        if (stadium.visible()) {
          stadium.marker().setMap(ctx.$data.map);
          addClickListener(stadium.marker(), stadium, ctx);
        } else {
          stadium.marker().setMap(null);
        }
      }

      function addClickListener(marker, data, bindingContext) {
        google.maps.event.addListener(marker, 'click', function() {
          var infowindow = bindingContext.$data.infowindow;
          infowindow.close();
          bindingContext.$data.selectedStadium(data);
          infowindow.open(bindingContext.$data.map,marker);
          addDOMListener(infowindow);
        });
      }

      function addDOMListener(infowindow) {
        google.maps.event.addListener(infowindow, 'domready', function() {
          var windowcontent = $('#selected-stadium-info').html();
          $('#info-window').html(windowcontent);
        });
      }
    }
  };

  ko.applyBindings(new ViewModel());
});
