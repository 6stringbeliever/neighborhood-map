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

    /*
       Returns a single string containing the searchable text for this
       stadium for searching more than just the name. Converted to
       uppercase so search is case independent.
    */
    this.searchString = ko.computed(function() {
      var searchString = this.name();
      for (var i = 0; i < this.teams().length; i++) {
        searchString += " " + this.teams()[i].name();
      }
      return searchString.toUpperCase();
    }, this);
  };

  var Filter = function(data) {
    this.league = ko.observable(data.league);
    this.display = ko.observable(data.display);
  };

  var stadiumData = [
    { 'name': 'Turner Field',
      'lat':  33.735278,
      'lng': -84.389444,
      'teams': [{ 'name': 'Atlanta Braves',
                  'league': 'MLB' }]
    },
    {
      'name': 'Target Field',
      'lat': 44.981667,
      'lng': -93.278333,
      'teams': [{ 'name': 'Minnesota Twins',
                  'league': 'MLB' }]
    },
    {
      'name': 'O.co Coliseum',
      'lat': 37.751667,
      'lng': -122.200556,
      'teams': [{ 'name': 'Oakland Athletics',
                  'league': 'MLB' },
                { 'name': 'Oakland Raiders',
                  'league': 'NFL'}]
    },
    {
      'name': 'Bridgestone Arena',
      'lat': 36.159167,
      'lng': -86.778611,
      'teams': [{ 'name': 'Nashville Predators',
                  'league': 'NHL' }]
    },
    {
      'name': 'American Airlines Center',
      'lat': 32.790556,
      'lng': -96.810278,
      'teams': [{ 'name': 'Dallas Stars',
                  'league': 'NHL' },
                { 'name': 'Dallas Mavericks',
                  'league': 'NBA' }]
    },
    {
      'name': 'Columbus Crew Stadium',
      'lat': 40.009444,
      'lng': -82.991111,
      'teams': [{ 'name': 'Columbus Crew',
                  'league': 'MLS' }]
    }
  ];

  var filtersData = [{'league': 'MLB',
                      'display': true},
                     {'league': 'NFL',
                      'display': true},
                     {'league': 'NBA',
                      'display': true},
                     {'league': 'NHL',
                      'display': true},
                     {'league': 'MLS',
                      'display': true}];

  var ViewModel = function() {
    var self = this;

    self.map = null;

    self.infowindow = null;

    self.filters = ko.observableArray([]);
    for (var filter in filtersData) {
      self.filters.push(new Filter(filtersData[filter]));
    }

    self.stadiums = ko.observableArray([]);
    for (var stadium in stadiumData) {
      self.stadiums.push(new Stadium(stadiumData[stadium]));
    }

    self.selectedStadium = ko.observable(null);

    self.showMarker = function(stadium) {
      self.selectedStadium(stadium);
    };

    self.toggleFilter = function(filter) {
      filter.display(!filter.display());
    };

    self.filterList = function() {
      var stad;
      var search = $('#stadium-search').val().toUpperCase();
      for (var i = 0; i < self.stadiums().length; i++) {
        stad = self.stadiums()[i];
        stad.visible(stad.searchString().indexOf(search) >= 0);
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
      var ctx = bindingContext.$data;

      ctx.map = new google.maps.Map(element, mapOptions);

      /*
        When the tiles are loaded, we detach all the KO views and reattach
        them as map controls. This way we get all the goodness of map controls
        but don't have to worry about when to ko.applyBinding.
      */
      google.maps.event.addListener(ctx.map, 'tilesloaded', function(e) {
        var control = document.createElement('div');
        control.id = 'stadium-list-control';
        var list = $('#stadium-list').detach();
        ctx.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(control);
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
      var ctx = bindingContext.$data;

      for (var i in value().stadiums()) {
        var stadium = value().stadiums()[i];
        if (stadium.visible()) {
          stadium.marker().setMap(ctx.map);
          addClickListener(stadium.marker(), stadium, ctx);
        } else {
          stadium.marker().setMap(null);
        }
      }

      function addClickListener(marker, data, bindingContext) {
        google.maps.event.addListener(marker, 'click', function() {
          bindingContext.selectedStadium(data);
        });
      }


    }
  };

  ko.bindingHandlers.infowindow = {
    /*
      On init, create the info window.
    */
    init: function(element, valueAccessor, allBindings,
                    viewModel, bindingContext) {
      var ctx = bindingContext.$data;
      ctx.infowindow = new google.maps.InfoWindow(
        { content: '<div id="info-window"></div>' });
    },

    /*
      On update of the selected stadium, show the infowindow in
      the appropriate spot or hide if null.
    */
    update: function(element, valueAccessor, allBindings,
                      viewModel, bindingContext) {
      var ctx = bindingContext.$data;
      var infowindow = ctx.infowindow;
      var stadium = valueAccessor().stadium();
      infowindow.close();
      if (stadium !== null) {
        infowindow.open(ctx.map, stadium.marker());
        addDOMListener(infowindow);
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
