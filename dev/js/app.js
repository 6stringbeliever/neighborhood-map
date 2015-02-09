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

    /*
       Returns an array of leagues that this stadium's teams play in.
    */
    this.inLeagues = ko.computed(function() {
      var leagues = [];
      for (var i = 0; i < this.teams().length; i++) {
        leagues.push(this.teams()[i].league());
      }
      return leagues;
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

  var ViewModel = function() {
    var self = this;
    var leagues = [];
    var i;

    self.map = null;

    self.infowindow = null;

    self.filters = ko.observableArray([]);

    self.stadiums = ko.observableArray([]);
    for (var stadium in stadiumData) {
      self.stadiums.push(new Stadium(stadiumData[stadium]));
      for (i = 0; i < stadiumData[stadium].teams.length; i++) {
        var team = stadiumData[stadium].teams[i];
        if (leagues.indexOf(team.league) < 0) {
          leagues.push(team.league);
        }
      }
    }

    for (i = 0; i < leagues.length; i++) {
      self.filters.push(new Filter({ 'league': leagues[i], 'display': true }));
    }

    self.selectedStadium = ko.observable(null);

    self.showMarker = function(stadium) {
      self.selectedStadium(stadium);
    };

    self.toggleFilter = function(filter) {
      filter.display(!filter.display());
      self.filterList();
    };

    // TODO: apply the last class via jquery, not css selector
    // TODO: display some sort of useful message when search returns no stadiums
    self.filterList = function() {
      var stad;
      var visible;
      var i, j;
      /* Convert the value in the search box to all upper case, trim white
         space and split into an array of terms. */
      var searchstring = $('#stadium-search').val().toUpperCase().trim();
      var searchterms = searchstring.split(/\s+/);
      var visibleleagues = [];
      for (var filter in self.filters()) {
        if (self.filters()[filter].display()) {
          visibleleagues.push(self.filters()[filter].league());
        }
      }

      /*
         Close the infowindow on the selected stadium if it doesn't pass the
         filters, otherwise, it will open back up again if you revert to no
         filters. You have to do this now because you can't close an
         infowindow attached to a marker that's not attached to the map.
      */
      if (self.selectedStadium() !== null &&
          !stadiumClearsFilters(self.selectedStadium(), searchterms, visibleleagues)) {
        self.selectedStadium(null);
      }

      /* Loop through all the stadiums. Hide the stadium if it doesn't match
         the league filters. Then check each stadium's computed search
         string against all the search terms we just computed. We only need
         one match to show the stadium, so break as soon as we get a match. */
      for (i = 0; i < self.stadiums().length; i++) {
        stad = self.stadiums()[i];
        visible = stadiumClearsFilters(stad, searchterms, visibleleagues);
        stad.visible(visible);
      }
    };
  };

  /*
    Returns true if the stadium passed in clears all the filters. First,
    its search string must match at least one search term. Second, at least
    one of its teams must be in a visible league.
  */
  var stadiumClearsFilters = function(stadium, searchterms, visibleleagues) {
    visible = false;
    if (isStadiumLeagueDisplayed(stadium, visibleleagues)) {
      for (j = 0; j < searchterms.length; j++) {
        if (stadium.searchString().indexOf(searchterms[j]) >= 0) {
          visible = true;
          break;
        }
      }
    }
    return visible;
  };

  /*
    Compares the leagues of all of a stadium's teams against
    the list of filtered leagues. Returns true if the stadium has a team
    in a league that is currently being shown.
  */
  var isStadiumLeagueDisplayed = function(stadium, filterleagues) {
    var displayed = false;
    var inleagues = stadium.inLeagues();
    for (var league in inleagues) {
      if (filterleagues.indexOf(inleagues[league]) >= 0) {
        displayed = true;
        break;
      }
    }
    return displayed;
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
