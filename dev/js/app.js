$(function() {
  
  var stadiumData = [
    { 'name': 'Turner Field',
      'lat':  33.735278,
      'long': -84.389444
    },
    {
      'name': 'Target Field',
      'lat': 44.981667, 
      'long': -93.278333
    }
  ];
  
  var ViewModel = function() {
    this.stadiums = ko.observableArray(stadiumData);
  };
  
  ko.applyBindings(new ViewModel());
});