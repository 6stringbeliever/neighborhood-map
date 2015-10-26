$(function() {

  'use strict';

  /*
      Stadium object. Holds all the data for a single stadium.
  */
  var Stadium = function(data) {
    this.name = ko.observable(data.name);
    this.lat = ko.observable(data.lat);
    this.lng = ko.observable(data.lng);
    /* Default visible to true unless it's set in the passed in data */
    this.visible = typeof data.visible === 'boolean' ?
                    ko.observable(data.visible) : ko.observable(true);
    this.teams = ko.observableArray([]);

    for (var i = 0; i < data.teams.length; i++) {
      this.teams.push({
        'name': ko.observable(data.teams[i].name),
        'league': ko.observable(data.teams[i].league)
      });
    }

    /*
       We'll get these items from Foursquare and the NY Times when the
       infowindow is displayed. Adding a nominal rate limit to the photos
       and articles arrays lets us load all photos at once in a for
       loop without causing the infowindow to reload with each photo.
    */
    this.foursquareid = ko.observable(null);
    this.foursquareid.extend({rateLimit: 50});
    this.address = ko.observableArray([]);
    this.address.extend({rateLimit: 50});
    this.photos = ko.observableArray([]);
    this.photos.extend({rateLimit: 50});

    this.articles = ko.observableArray([]);
    this.articles.extend({rateLimit: 50});

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
        Returns the appropriate marker icon for the sport
        or for multiple sports in the same venue.
    */
    this.icon = ko.computed(function() {
      var icon;
      var league = 'multi';
      if (this.teams() && this.teams().length == 1) {
        league = this.teams()[0].league().toLowerCase();
      }
      icon = 'img/' + league + '-marker.png';
      return {'anchor': new google.maps.Point(12,12),
              'url': icon};
    }, this);

    /*
       Returns a Google maps marker for the stadium.
    */
    this.marker = ko.observable(new google.maps.Marker({
      position: this.mapPoint(),
      title: this.name(),
      icon: this.icon()
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
  }; // Stadium

  /*
      Filter object for each of league filters.
  */
  var Filter = function(data) {
    this.league = ko.observable(data.league);
    this.display = ko.observable(data.display);
    this.imageSrc = ko.computed(function() {
      var filename;
      var directory = "img/";
      if (this.display()) {
        filename = this.league().toLowerCase() + ".png";
      } else {
        filename = this.league().toLowerCase() + "-off.png";
      }
      return directory + filename;
    }, this);
    this.hover = ko.computed(function() {
      var hoverstring = this.display() ? 'Hide ' : 'Show ';
      hoverstring += this.league() + ' Stadiums';
      return hoverstring;
    }, this);
  };

  /*
      Keep track of whether an asynchronous call to one of our data sources is
      in progress. Don't make a new call to the source until the first one
      finishes. Used to track the status messages on the infowindow and make
      sure we're not making extra calls.
  */
  var remoteDataHelper = {
    gettingNYTimesData: false,
    gettingFoursquareData: false,
    gettingFoursquarePhotos: false,
    /*
        Returns true if any of our functions are currently getting data.
    */
    isGettingData: function() {
      return this.gettingNYTimesData || this.gettingFoursquareData ||
       this.gettingFoursquarePhotos;
    },
    /*
        Starts and manages the process for getting stadium data from
        remote sources.
    */
    getRemoteData: function(stad, datastatus) {
      console.log("Get remote data");
      datastatus.gettingdata(this.isGettingData());
      datastatus.errors([]);
      if (stad.foursquareid() === null) {
        this.getFoursquareData(stad, datastatus);
      }
      if (stad.articles().length === 0) {
        this.getNYTimesData(stad, datastatus);
      }
    },
    /*
        Download Foursquare data asynchronously.
    */
    getFoursquareData: function(stad, datastatus) {
      var self = this;
      if (!self.gettingFoursquareData) {
        self.gettingFoursquareData = true;
        datastatus.gettingdata(self.isGettingData());
        $.ajax({
          dataType: "json",
          url: buildFoursquareSearchQuery(stad.lat(), stad.lng(), stad.name()),
          success: function(data) {
            console.log("Got 4sq data");
            var addr, venue;
            venue = data.response.venues[0];
            if (stad.address.length === 0) {
              for (addr in venue.location.formattedAddress) {
                stad.address.push(venue.location.formattedAddress[addr]);
              }
            }
            stad.foursquareid(venue.id);
            self.gettingFoursquareData = false;
            datastatus.gettingdata(self.isGettingData());
            if (stad.photos().length === 0) {
              self.getFoursquarePhotos(stad, datastatus);
            }
          },
          error: function() {
            console.log("Error getting foursquare data");
            self.gettingFoursquareData = false;
            datastatus.errors.push("Error getting Foursquare data");
            datastatus.gettingdata(self.isGettingData());
          }
        });
      }
    },
    /*
        Download photos asynchronously from 4sq and update when complete.
    */
    getFoursquarePhotos: function(stad, datastatus) {
      var self = this;
      if (!self.gettingFoursquarePhotos) {
        console.log("getting photos");
        self.gettingFoursquarePhotos = true;
        datastatus.gettingdata(self.isGettingData());
        $.ajax({
          dataType: "json",
          url: buildFoursquarePhotosQuery(stad.foursquareid()),
          success: function(data) {
            console.log("got photos");
            var photos = data.response.photos.items;
            if (stad.photos.length === 0) {
              for (var photo in photos) {
                var photourl = photos[photo].prefix + "cap300" + photos[photo].suffix;
                stad.photos.push(photourl);
              }
            }
            self.gettingFoursquarePhotos = false;
            datastatus.gettingdata(self.isGettingData());
          },
          error: function(jqhxr, status, error) {
            console.log("Error getting photos");
            self.gettingFoursquarePhotos = false;
            datastatus.errors.push("Error getting Foursquare photos");
            datastatus.gettingdata(self.isGettingData());
          }
        });
      }
    },
    /*
        Get NY Times articles for the stadium.
    */
    getNYTimesData: function(stad, datastatus) {
      var self = this;
      if (!self.gettingNYTimesData) {
        self.gettingNYTimesData = true;
        datastatus.gettingdata(self.isGettingData());
        $.ajax({
          dataType: "json",
          url: buildNYTimesArticleURL(stad.name()),
          success: function(data) {
            var docs;
            if (data.status === 'OK' && stad.articles.length === 0) {
              docs = data.response.docs;
              for (var doc in docs) {
                stad.articles.push({
                  'url': docs[doc].web_url,
                  'headline': decodeHtmlEntity(docs[doc].headline.main)
                });
              }
              console.log("Got NY Times articles");
            } else {
              console.log("Error getting NY Times articles");
              datastatus.errors.push("Error getting NY Times articles");
            }
            self.gettingNYTimesData = false;
            datastatus.gettingdata(self.isGettingData());
          },
          error: function(jqhxr, status, error) {
            console.log("Error getting NY Times articles");
            self.gettingNYTimesData = false;
            datastatus.errors.push("Error getting NY Times articles");
            datastatus.gettingdata(self.isGettingData());
          }
        });
      }
    },
    reset: function() {
      this.gettingNYTimesData = false;
      this.gettingFoursquareData = false;
      this.gettingFoursquarePhotos = false;
    }
  }; // Remote data helper


  var ViewModel = function() {
    var self = this;
    var league;
    var stadiumDataAlpha;
    var leagues = [];

    self.map = null;

    self.infowindow = null;

    self.datastatus = ko.observable({
      gettingdata: ko.observable(true),
      errors: ko.observableArray([])
    });

    self.searchtext = ko.observable("");
    self.searchtext.extend({
      rateLimit: {
        timeout: 400,
        method: "notifyWhenChangesStop"
      }
    });
    self.clearSearchText = function() {
      this.searchtext('');
    };

    /* List of leagues to filter */
    self.filters = ko.observableArray([]);
    /* Tracks whether to show message that search results returned no data. */
    self.emptysearch = ko.observable(false);

    self.stadiums = ko.observableArray([]);
    self.stadiums.extend({
      rateLimit: {
        timeout: 20,
        method: "notifyWhenChangesStop"
      }
    });

    /* Alphabetize the stadium list */
    stadiumDataAlpha = stadiumData.sort(function(a, b) {
      /* Upper case so sort is case insensitive. */
      var aup = a.name.toUpperCase();
      var bup = b.name.toUpperCase();
      if (aup < bup) {
        return -1;
      }
      if (aup > bup) {
        return 1;
      }
      // a must be equal to b
      return 0;
    });

    for (var stadium in stadiumDataAlpha) {
      self.stadiums.push(new Stadium(stadiumData[stadium]));
      for (var i = 0; i < stadiumData[stadium].teams.length; i++) {
        var team = stadiumData[stadium].teams[i];
        if (leagues.indexOf(team.league) < 0) {
          leagues.push(team.league);
        }
      }
    }

    self.selectedStadium = ko.observable(null);
    self.selectedStadium.extend({
      rateLimit: {
        timeout: 10,
        method: "notifyWhenChangesStop"
      }
    });

    /*
        Sets the stadium to show a marker for and resets the remote data
        trackers since we're getting data for a different stadium.
        Stadium list control li's are bound to this function on click.
        Controls the bouncey animation on select.
    */
    self.showMarker = function(stadium) {
      self.toggleMenu(false);
      remoteDataHelper.reset();
      stadium.marker().setAnimation(google.maps.Animation.BOUNCE);
      window.setTimeout(function() {
        stadium.marker().setAnimation(null);
      }, 2000);
      self.selectedStadium(stadium);
      remoteDataHelper.getRemoteData(stadium, self.datastatus());
    };

    /*
        The button to show or hide the search, filters, and stadium list appears
        based on screen size. This toggles these items when the button is
        clicked. True to open, false to close. Don't pass a value to open
        to toggle.
    */
    self.toggleMenu = function(open) {
      $('#stad-list-hideable').toggleClass('stad-menu-offsmall', typeof open ==='undefined' ? open : !open);
      $('#stad-list-menu-toggle .fa').toggleClass('fa-caret-down', typeof open ==='undefined' ? open : !open);
      $('#stad-list-menu-toggle .fa').toggleClass('fa-caret-up', open);
    };

    /*
        Toggles the stadium type filter when it's clicked on the map.
    */
    self.toggleFilter = function(filter) {
      filter.display(!filter.display());
    };

    /*
        Processes the search and stadium type filters each time
        they are updated and sets stadium to visible or not based on
        if it matches the search and filters.
    */
    self.filterList = function() {
      var stad;
      var visible;
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
        console.log("Setting stadium to null");
      }

      /* Loop through all the stadiums. Hide the stadium if it doesn't match
         the league filters. */
      for (var i = 0; i < self.stadiums().length; i++) {
        stad = self.stadiums()[i];
        visible = stadiumClearsFilters(stad, searchterms, visibleleagues);
        stad.visible(visible);
        if (emptysearch && visible) {
          emptysearch = false;
        }
      }
      /* Stadiums isn't dependent on visible since we call visible.peek()
         in the map binding, so we have to call valueHasMutated on stadiums
         here to get the map to redraw markers. */
      self.stadiums.valueHasMutated();
      self.emptysearch(emptysearch);
      setLastChildToClass(".stad-list-ul", "stad-list-last");
    }; // filterList

    /*
       Subscribe the search field and all league filters to the filter method
       so the list is filtered any time either is changed.
    */
    self.searchtext.subscribe(self.filterList);
    for (var j = 0; j < leagues.length; j++) {
      league = new Filter({ 'league': leagues[j], 'display': true });
      league.display.subscribe(self.filterList);
      self.filters.push(league);
    }
  }; // ViewModel

  /*
    Returns true if the stadium passed in clears all the filters. First,
    its search string must match at least one search term. Second, at least
    one of its teams must be in a visible league.
  */
  var stadiumClearsFilters = function(stadium, searchterms, visibleleagues) {
    var visible = false;
    if (isStadiumLeagueDisplayed(stadium, visibleleagues)) {
      for (var j = 0; j < searchterms.length; j++) {
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
        scrollwheel: false,
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
      google.maps.event.addListenerOnce(ctx.map, 'tilesloaded', function(e) {
        console.log("adding event listener");
        var control = document.createElement('div');
        control.id = 'stadium-list-control';
        var list = $('#stadium-list').detach();
        ctx.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(control);
        list.appendTo('#stadium-list-control');
        $('#stad-list-menu-toggle').click(function() {
          ctx.toggleMenu();
        });
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
      console.log("Calling update on map");
      for (var i in value().stadiums()) {
        var stadium = value().stadiums()[i];
        /* Call peek() on visible so we don't create a new dependency
           that will cause this to be evaluated over and over. Massive
           performance hit if we don't do this. */
        if (stadium.visible.peek()) {
          stadium.marker().setMap(ctx.map);
          addClickListener(stadium.marker(), stadium, ctx);
        } else {
          stadium.marker().setMap(null);
          console.log("Removing from map");
        }
      }

      function addClickListener(marker, data, bindingContext) {
        google.maps.event.clearListeners(marker, 'click');
        google.maps.event.addListener(marker, 'click', function() {
          bindingContext.showMarker(data);
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
      console.log("Update info window");
      var ctx = bindingContext.$data;
      var infowindow = ctx.infowindow;
      var stadium = valueAccessor().stadium();
      var messages = valueAccessor().messages();

      infowindow.close();
      if (stadium !== null) {
        infowindow.open(ctx.map, stadium.marker());
        addDOMListener(infowindow);
        /*
            We don't need to do anything with these, just create the bindings
            with the children of the stadium and datastatus objects so it will
            update the infowindow when they change.
        */
        var gettingdata = valueAccessor().messages().gettingdata();
        var errors = valueAccessor().messages().errors();
        var photos = valueAccessor().stadium().photos();
        var address = valueAccessor().stadium().address();
        var articles = valueAccessor().stadium().articles();
      } else {
        console.log("Stadium is null");
      }

      function addDOMListener(infowindow) {
        google.maps.event.addListener(infowindow, 'domready', function() {
          var windowcontent = $('#selected-stadium-info').html();
          $('#info-window').html(windowcontent);
        });
      }
    }
  };

  /*
      Returns a URL to a Foursquare query that is most likely to return
      the appropriate stadium ID and data as the first result. Takes
      the latitude, longitude, and name of the stadium object. Number of
      results defaults to 5, or can be set in numresults. Preferring to
      return a few results for now in case we need to further filter.
  */
  function buildFoursquareSearchQuery(lat, long, name, numresults) {
    var limit = numresults || 5;
    var query = "https://api.foursquare.com/v2/venues/search" +
      "?client_id=HPTKFD3QU12Y0FPPQ0OVTZ51RFAYJ5L4104MNJJL0CW2HEEQ" +
      "&client_secret=YLBK5PYZW4FZNK0QIQX5SCJOQS4TYYEHR2LZ2SHYGJLXJCLE" +
      "&v=20130815&ll=" + lat + "," + long + "&intent=checkin&radius=500" +
      "&limit=" + limit;
    // stadium: 4bf58dd8d48988d184941735
    // college stadium: 4bf58dd8d48988d1b4941735
    query += "&categoryId=4bf58dd8d48988d184941735,4bf58dd8d48988d1b4941735";
    query += "&query=" + encodeURIComponent(name);
    return query;
  }

  /*
    Returns a URL to return a JSON list of photos for the specified
    Foursquare ID. Default limit is 5, or specify in numphotos.
  */
  function buildFoursquarePhotosQuery(id, numphotos) {
    var limit = numphotos || 5;
    var query = "https://api.foursquare.com/v2/venues/" + id + "/photos?" +
      "client_id=HPTKFD3QU12Y0FPPQ0OVTZ51RFAYJ5L4104MNJJL0CW2HEEQ" +
      "&client_secret=YLBK5PYZW4FZNK0QIQX5SCJOQS4TYYEHR2LZ2SHYGJLXJCLE" +
      "&v=20130815";
    query += "&limit=" + limit;
    return query;
  }

  /*
      Returns a URL to return a JSON list of articles from the NY Times
      related to the passed in stadium data.
  */
  function buildNYTimesArticleURL(name) {
    var query = "http://api.nytimes.com/svc/search/v2/articlesearch.json?" +
      "&api-key=5970e8422dc755c43539b1a554bd3017:18:34329006";
    var fq = 'news_desk:("Sports") AND body:("' + name + '")';
    query += "&fq=" + encodeURIComponent(fq);
    return query;
  }

  /*
      Decodes the HTML entities in the passed in string.
      Src: https://gist.github.com/CatTail/4174511
  */
  function decodeHtmlEntity(str) {
    return str.replace(/&#(\d+);/g, function(match, dec) {
      return String.fromCharCode(dec);
    });
  }

  /*
      Make sure the google maps api is loaded before applying bindings. Toss up
      an error message if it's not since the app is not usable w/o google maps.
  */
  if (typeof google !== 'undefined') {
    ko.applyBindings(new ViewModel());
  } else {
    console.log("Error loading Google Maps API");
    $('.map-canvas').hide();
    $('body').prepend('<div class="error-dialog"><p class="error-message">' +
                      'There was an error loading Google Maps. Please check ' +
                      'your internet connection or try again later.</p></div>');
  }
});
