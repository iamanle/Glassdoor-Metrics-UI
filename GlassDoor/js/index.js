/**
 * Front-end JS to load filtered data from the mongo-connector endpoint
 * and display it on the main page.
 */
(function($) {
  $('#surveyButton').hide();
  $('#companyDetails').hide();

  var companies;
  var companiesInfo;
  var companyInfo;

  function getCompanyNames () {
    $.getJSON('http://localhost:3001/companies', function (data) {
      initTypeahead(data.companies);
      initSearchValidation(data.companies);
    });
  }

  function getCompanyInfo(companyName){
    $.getJSON('http://localhost:3001/uiContent?name=' + companyName, function(data){
      companiesInfo = data;
      var companyIndex = findCompanyInArray(companyName);
      if(companyIndex !== -1){
        companyInfo = companiesInfo.data[companyIndex];

        console.log("Get company Info", companyInfo);

        $("#industry").replaceWith(companyInfo.industry);
        $("#size").replaceWith(companyInfo.size);
        $("#competitors").replaceWith(companyInfo.competitors);

        $.getJSON("http://localhost:3001/details?name=" + companyName).then(function (resultSet) {
          $("#interactionPoint").text(Math.round((resultSet[0].interactionPoints[(resultSet[0].interactionPoints).length - 2]).interactionPoint));
        });


        $('#companyDetails').show();
      }
    });
  }

  function findCompanyInArray(companyName){
    for(var i = 0; i < companiesInfo.data.length; i++){
      if(companiesInfo.data[i].companyName === companyName)
        return i;
    }
    return -1;
  }

  /**
   * Load the interaction points for a given company
   * @param companyName {String}
   * @param callback {function} method to execute on completion
   */
  function getCompanyInteractionPoints (companyName, callback) {
    $.getJSON('http://localhost:3001/interactionPoints?name=' + companyName, callback);
  }

  /**
   * Query the db for the details of a specific company. Puts the
   * results directly into the results table on the page.
   * @method queryDb
   * @param companyName {String}
   */
  function queryDb (companyName, callback) {
    var baseUrl = 'http://localhost:3001/details?name=';
    var finalResults = [];

    // fancy Promises based stuff that lets us pretend asynchronous calls are synchronous
    $.getJSON(baseUrl + companyName).then(function (resultSet) {
      finalResults.push(resultSet[0]);
        if(!resultSet[0].competitors) {
          return finalResults;
        }

        resultSet[0].competitors = resultSet[0].competitors.filter(function (c) {
          // filter out the non-truthy values, e.g. empty string
          return c;
        });

        $.when.apply($, resultSet[0].competitors.map(function (companyName) {
          return $.getJSON(baseUrl + companyName);
        })).done(function () {
          for (var i = 0; i < arguments.length; i++) {
            if (arguments[i][0]) {
              finalResults.push(arguments[i][0][0]);
            }
          }

          if(typeof callback === 'function') {
            callback(companyName, finalResults);
          } else {
            createResultsTable(companyName, finalResults);
          }

        });
      });
  }

  /**
   * Helper method to convert a interaction points object into an
   * array of arrays in the format that Highcharts uses
   * @method interactionPointsToArr
   * @param points {Object} points from db response
   * @return {Array} reformatted version of points
   */
  function interactionPointsToArr (points) {
    var arr = [];

    for (var curr in points) {
      arr.push([points[curr].time, points[curr].interactionPoint]);
    }

    return arr;
  }

  /**
   * Sum the interaction points for the passed company
   * @method sumInteractionPoints
   * @param company {Object}
   * @return {Number}
   */
  function sumInteractionPoints (company) {
    var i;
    var totalInteractions = 0;

    for (i = 0; i < company.interactionPoints.length; i++) {
      totalInteractions += company.interactionPoints[i].interactionPoint;
    }

    return totalInteractions;
  }

  /**
   * Create and display the Highcharts results table
   * @method createResultsTable 
   * @param resultSet {Object} the db results to use,
   * will be in the form
   * {
   *   result: [
   *     {
   *       //main company desciption object
   *     },
   *     [
   *       // competitor description objects in an array
   *     ]
   *   ]
   * }
   * @event fires a 'tableRendered' event when it is done
   */
  function createResultsTable (companyName, resultSet) {
    // Update title and heading
    document.title = companyName + ' interaction point';
    $("#heading").text(companyName);
    $('#surveyButton').show();
    $('#companyDetails').show();

    
    if (!resultSet || !companyName) {
      console.log('companyName or resultSet is not defined.')
      return;
    }

    var companySet = [];
    var drilldownArray = [];
    var seriesArray = [{
      name: 'Companies',
      colorByPoint: true,
      data: []
    }];

    for (var i in resultSet) {
      if (resultSet[i] && resultSet[i].companyName) {
        companySet.push({
          name: resultSet[i].companyName,
          y: sumInteractionPoints(resultSet[i]),
          drilldown: resultSet[i].companyName
        });

        drilldownArray.push({
          name: resultSet[i].companyName,
          id: resultSet[i].companyName,
          data: interactionPointsToArr(resultSet[i].interactionPoints)
        });
      }

    }

    seriesArray[0].data = companySet;
    // Stash the initial values onto the DOM node so we can get them back for
    // date range filtering later on
    if (!$('#overview').data('initialData')) {
      $('#overview').data('initialData', resultSet);
    }


    //------------Interaction Point Chart---------------
    $(function () {
      // Create the chart
      $('#overview').highcharts({
        chart: {
          type: 'column'
        },
        title: {
          text: companyName + ' Interaction Points'
        },
        subtitle: {
          text: ''
        },
        xAxis: {
          type: 'category'
        },
        yAxis: {
          title: {
            text: 'Total interaction points'
          }
        },
        legend: {
          enabled: false
        },
        plotOptions: {
          series: {
            borderWidth: 0,
            dataLabels: {
              enabled: true,
              format: '{point.y:.0f}'
            }
          }
        },
        tooltip: {
          headerFormat: '<span style="font-size:11px">{series.name}</span><br>',
          pointFormat: '<span style="color:{point.color}">{point.name}</span>: <b>{point.y:.0f}</b> interaction points<br/>'
        },
        series: seriesArray,
        drilldown: {
          series: drilldownArray
        }
      });
    });

    // publish the event that will tell the date range picker to update
    $('#results-date-filter').trigger('tableRendered', resultSet);
  }

  //------------Content Change Chart---------------
  /**
   * Create the line chart showing monthly content changes for the primary company
   * and its competitors.
   * @param companyName {String}
   * @param resultSet {Array}
   */
  function renderContentChangeChart (resultSet) {
    var i,
      j,
      currSeries;

    var chartConfig = {
      title: {
        text: ''
      },
      subtitle: {
      },
      xAxis: {
        categories: []
      },
      yAxis: {
        title: {
          text: 'Monthly Content Change'
        },
        plotLines: [
          {
            value: 0,
            width: 1,
            color: '#80800'
          }
        ]
      },
      series: []
    };

    // Stash the initial values onto the DOM node so we can get them back for
    // date range filtering later on
    $('#contentChangeMonthly').data('seriesArray', resultSet);

    // convert to format that Highcharts needs
    for (i in resultSet) {
      // Create or update the title string
      chartConfig.title.text += resultSet[i].name;

      if (i < resultSet.length - 1) {
        chartConfig.title.text += ', '
      } else {
        chartConfig.title.text += ' - Monthly Content Change'
      }

      currSeries = {
        name: resultSet[i].name,
        data: []
      };

      // only show the new count of content and the date
      for (j in resultSet[i].data) {
        currSeries.data.push([resultSet[i].data[j].time, resultSet[i].data[j].newCount]);
      }

      chartConfig.series.push(currSeries);
    }

    $('#contentChangeMonthly').highcharts(chartConfig);

  }

  /**
   * Query the db and call to create the line chart with monthly values
   * @param companyName {String} main company to compare against
   */
  function createContentChangeChart (companyName) {
    var companyList = [companyName];

    $.getJSON("http://localhost:3001/details?name=" + companyName).then(function (resultSet) {
      // get competitors
      companyList = companyList.concat(resultSet[0].competitors);
      $.when.apply($, companyList.map(function (companyName) {
        return $.getJSON('http://localhost:3001/interactionPoints?name=' + companyName);
      })).done(function () {
        // collect content deltas for main + competitors
        var i,
          resultSet = [];

        for (i in arguments) {
          resultSet.push(arguments[i][0])
        }
        // call for the chart to be rendered
        renderContentChangeChart(resultSet);
      });
    });
  }

  var substringMatcher = function(strs) {
    return function findMatches(q, cb) {
      var matches, substringRegex;

      // an array that will be populated with substring matches
      matches = [];

      // regex used to determine if a string contains the substring `q`
      substringRegex = new RegExp(q, 'i');

      // iterate through the pool of strings and for any string that
      // contains the substring `q`, add it to the `matches` array
      $.each(strs, function(i, str) {
        if (substringRegex.test(str)) {
          matches.push(str);
        }
      });

      cb(matches);
    };
  };

  function showError ()  {
    $('.alert-danger').removeClass('hidden');
  }

  function hideError () {
    $('.alert-danger').addClass('hidden');
  }

  function doSearch () {
    var companyName = $('#company-name').val();
    hideError();
    queryDb(companyName);
    getCompanyInfo(companyName);
    createContentChangeChart(companyName);
  }

  var validateName; 
  function initSearchValidation (companies) {
    validateName = function (val) {
      return val !== '' && companies.indexOf(val) !== -1;
    }
  }
  
  function initTypeahead (companies) {
    $('#company-search .typeahead').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
      },
      {
        name: 'companies',
        source: substringMatcher(companies)
      });

    $('.typeahead').on('typeahead:close', function() {
      if (validateName($("#company-name").val(), companies)) {
        hideError();
      }
    });
  }


  // Search submit listener
  $('[name="search-form"]').on('submit', function (e) {
    e.preventDefault();
    doSearch();
  });


  // Ugly JQuery listener for custom event has to be tied to a DOM node
  $('#results-date-filter').on('tableRendered', function (e, resultSet) {

    // Find the earliest date that all companies have data for
    function getFirstDateUniv(companies) {
      return '01-01-2012';
      // var firstDate = '0000-00';
      //  for (var companyName in companies) {
      //    var url = 'http://localhost:3001/details?name=' + companyName;
      //    // create object company from the json got from url
      //    $.getJSON(url, function(company){
      //      var date = getfirstDate(company);
      //      if (date < firstDate) {
      //        firstDate = date;
      //      }
      //    });
      //  }
      // var formattedDate = new Date(firstDate);
      // return alert((formattedDate.getMonth() + 1) + '/' + formattedDate.getDate() + '/' +  formattedDate.getFullYear());
    }

    // Find the last date that all companies have data for
    function getLastDateUniv(companies) {
      return '01-04-2016';
      // var lastDate = '0000-00';
      // for (var companyName in companies) {
      //   var url = 'http://localhost:3001/details?name=' + companyName;
      //   // create object company from the json got from url
      //   $.getJSON(url, function(company){
      //     var date = getlastDate(company);
      //     if (date > lastDate) {
      //       lastDate = date;
      //     }
      //   });
      // }
      // var formattedDate = new Date(lastDate);
      // return alert((formattedDate.getMonth() + 1) + '/' + formattedDate.getDate() + '/' +  formattedDate.getFullYear());
    }

    /**
     * get date range for single company
     * @method getfirstDate
     * @method getlastDate
     * @param company {Object}
     * @return {String}
     */

    function getfirstDate (company) {
      var firstDate;
      var InterviewDates = Object.keys(company.interviews);
      var ReviewDates = Object.keys(company.reviews);
      var firstInterviewDate = InterviewDates[1];
      var firstReviewDate = ReviewDates[1];
      if (firstInterviewDate < firstReviewDate) {
        firstDate = firstInterviewDate;
      } else {
        firstDate = firstReviewDate;
      }
      return firstDate;
    }

    function getlastDate (company) {
      var lastDate;
      var InterviewDates = Object.keys(company.interviews);
      var ReviewDates = Object.keys(company.reviews);
      var lastInterviewDate = InterviewDates[-1];
      var lastReviewDate = ReviewDates[-1];
      if (lastInterviewDate < lastReviewDate) {
        lastDate = lastReviewDate;
      } else {
        lastDate = lastInterviewDate;
      }
      return lastDate;
    }

    // Min / Max date and initial start / end dates are the same
    var startAndEndDates = [getFirstDateUniv(), getLastDateUniv()];

    $('input[name="daterange"]').daterangepicker({
      'minDate': startAndEndDates[0],
      'maxDate': startAndEndDates[1],
      'startDate':startAndEndDates[0],
      'endDate': startAndEndDates[1]
    });

    function filterOverviewChartDates (startDate, endDate) {
      var initialData = $('#overview').data('seriesArray');
      var drillDownData = $('#overview').data('drilldownArray');
      console.log('overview initial data:');
      console.log(initialData);
      console.log(drillDownData);
    }

    function filterContentChangeChartDates (startDate, endDate) {
      var initialData = $('#contentChangeMonthly').data('initialData');
      console.log('monthly initial data:');
      console.log(initialData);
      var filteredData;

      startDate = new Date(startDate);
      endDate = new Date(endDate);

      filteredData = initialData[0].data.filter(function (curr) {
        var currDate = new Date(curr[0]);
        return startDate <= currDate && currDate <= endDate;
      });

      renderContentChangeChart(initialData[0].name, filteredData);
    }

    // React to changes in the selected date range
    $('input[name="daterange"]').on('apply.daterangepicker', function (ev, picker) {
      filterOverviewChartDates(picker.startDate, picker.endDate);
      filterContentChangeChartDates(picker.startDate, picker.endDate);
    });

    // Show the container for the date range picker
    $('#results-date-filter').removeClass('hidden');

  });

  /**
   * Modal for survey
   */
  $('#myModal').on('shown.bs.modal', function () {
    $('#myInput').focus()
  });

  getCompanyNames();

  $('[data-toggle="tooltip"]').tooltip();
}($));
