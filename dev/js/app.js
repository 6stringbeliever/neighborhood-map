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
       We'll get these items from Foursquare when the infowindow is displayed.
    */
    this.foursquareid = ko.observable(null);
    this.address = ko.observableArray([]);
    this.photos = ko.observableArray([]);

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
    var league;
    var leagues = [];
    var i;

    self.map = null;

    self.infowindow = null;

    self.searchtext = ko.observable("");
    self.searchtext.extend({ rateLimit: {
                                timeout: 400,
                                method: "notifyWhenChangesStop" } });


    self.filters = ko.observableArray([]);
    self.emptysearch = ko.observable(false);

    // TODO: sort the list alphabetically
    // TODO: refactor for performance (don't push all values in one by because)
    //       that will force redraws each time.
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

    self.selectedStadium = ko.observable(null);

    self.showMarker = function(stadium) {
      self.selectedStadium(stadium);
    };

    self.toggleFilter = function(filter) {
      filter.display(!filter.display());
    };

    self.filterList = function() {
      var stad;
      var visible;
      var i, j;
      /* Convert the value in the search box to all upper case, trim white
         space and split into an array of terms. */
      var searchstring = self.searchtext().toUpperCase().trim();
      var searchterms = searchstring.split(/\s+/);
      var visibleleagues = [];
      var emptysearch = true;
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
        if (emptysearch && visible) {
          emptysearch = false;
        }
      }
      self.emptysearch(emptysearch);
      setLastChildToClass(".stad-list-ul", "stad-list-last");
    };

    /*
       Subscribe the search field and all league filters to the filter method
       so the list is filtered any time either is changed.
    */
    self.searchtext.subscribe(self.filterList);
    for (i = 0; i < leagues.length; i++) {
      league = new Filter({ 'league': leagues[i], 'display': true });
      league.display.subscribe(self.filterList);
      self.filters.push(league);
    }
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

  /*
     Sets the last direct child of the passed in element to include the passed
     in class. Remove the class from other elements first. This let's us
     manually set the last child class on the stadium list since the
     :last-child css selector doesn't understand when children aren't visible.
  */
  var setLastChildToClass = function(element, classtoapply) {
    $("." + classtoapply).removeClass(classtoapply);
    $(element).children().filter(':visible:last').addClass(classtoapply);
  };


  /*
      Checks if stadium data has already been downloaded from API sources.
      If not, download asynchronously and update when complete.
  */
  var getStadiumData = function(stad) {
    if (stad.foursquareid() === null) {
      $.ajax({
        dataType: "json",
        url: buildFoursquareSearchQuery(stad.lat(), stad.lng(), stad.name()),
        success: function(data) {
          var addr, venue;
          venue = data.response.venues[0];
          stad.foursquareid(venue.id);
          for (addr in venue.location.formattedAddress) {
            stad.address.push(venue.location.formattedAddress[addr]);
          }
          getFoursquarePhotos(stad);
        },
        error: function() {
          console.log("Error getting foursquare data");
        }
      });
    } else {
      getFoursquarePhotos(stad);
    }
  };


  /*
      Checks if photos have already been downloaded from Foursquare. If not,
      download asynchronously and update when complete.
  */
  var getFoursquarePhotos = function(stad) {
    console.log("id " + stad.foursquareid());
    console.log("# photos " + stad.photos().length);
    if (stad.foursquareid() !== null && stad.photos().length === 0) {
      console.log("getting photos");
      console.log(buildFoursquarePhotosQuery(stad.foursquareid()));
      $.ajax({
        dataType: "json",
        url: buildFoursquarePhotosQuery(stad.foursquareid()),
        success: function(data) {
          console.log("got photos");
          var photos = data.response.photos.items;
          for (var photo in photos) {
            var photourl = photos[photo].prefix + "cap300" + photos[photo].suffix;
            stad.photos().push(ko.observable(photourl));
          }
        },
        error: function(jqhxr, status, error) {
          console.log("don't got photos");
        }
      });
    } else {
      console.log("already have photos");
    }
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
        getStadiumData(stadium);
      }

      function addDOMListener(infowindow) {
        google.maps.event.addListener(infowindow, 'domready', function() {
          var windowcontent = $('#selected-stadium-info').html();
          $('#info-window').html(windowcontent);
        });
      }
    }
  };


  function buildFoursquareSearchQuery(lat, long, name) {
    var query = "https://api.foursquare.com/v2/venues/search" +
      "?client_id=HPTKFD3QU12Y0FPPQ0OVTZ51RFAYJ5L4104MNJJL0CW2HEEQ" +
      "&client_secret=YLBK5PYZW4FZNK0QIQX5SCJOQS4TYYEHR2LZ2SHYGJLXJCLE" +
      "&v=20130815&ll=" + lat + "," + long + "&intent=match&query=";
    query += encodeURIComponent(name);
    return query;
  }

  function buildFoursquarePhotosQuery(id) {
    var query = "https://api.foursquare.com/v2/venues/" + id + "/photos?" +
      "client_id=HPTKFD3QU12Y0FPPQ0OVTZ51RFAYJ5L4104MNJJL0CW2HEEQ" +
      "&client_secret=YLBK5PYZW4FZNK0QIQX5SCJOQS4TYYEHR2LZ2SHYGJLXJCLE" +
      "&v=20130815";
    return query;
  }

  ko.applyBindings(new ViewModel());
});
