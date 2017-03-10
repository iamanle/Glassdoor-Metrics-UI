/**
 * localhost:27017/glassdoor
 */
var express = require('express');
var mongojs = require('mongojs');
var cors = require('cors');
var http = require('http');
var app = express();
app.use(cors());

app.get('/competitors', function (req, res) {
    var db = mongojs('localhost:27017/glassdoor');
    var collection = db.collection('uiContent');
  
    if(!req.query || !req.query.name) {
      res.json({});
      db.close();
      return;
    }
    collection.find({companyName: req.query.name}, function (err, docs) {
        res.json({competitors: docs[0].competitors});
        db.close();
    });
});

app.get('/details', function (req, res) {
    var db = mongojs('localhost:27017/glassdoor');
    var collection = db.collection('uiContent');
    var accumulator = [];
    var companyCollection;

  if(!req.query || !req.query.name) {
    res.json({});
    db.close();
    return;
  }

    collection.find({companyName: req.query.name}, function(err, docs) {
        if (docs.length === 0) {
          res.json({});
          return;
        }

        var competitorList = docs[0].competitors.split(',');
        companyCollection = db.collection(req.query.name);
        companyCollection.find({}, {'interactionPoint':1, 'time':1, '_id':0}).sort({'time':1}, function (err, docs) {
          accumulator.push({
            companyName: req.query.name,
            interactionPoints: docs,
            competitors: competitorList
          });  

          res.json(accumulator);
          db.close();
          return;
         });
  });
});
//        for (var c = 0; c < competitorList.length; c++) {
//          companyCollection = db.collection(competitorList[c]);
//
//          companyCollection.find({}, {'interactionPoint':1, 'time':1, '_id':0}).sort({'time':1}, function (err, docs) {
//            accumulator.push({
//              companyName: competitorList[c],
//              interactionPoints: docs
//            });  
//          
//            if(c === competitorList.length) {
//              res.json({'result': accumulator});
//              return;
//            } else {
//              console.log(c);
//            }
//          });
//
//        }
        
//companyCollection.find({companyName: {$in: competitorList}}, function (err, competitors) {
//           console.log('competitors:');
//           console.log(competitors);
// 
//            if(competitors.length > 0) {
//              for(var i = 0; i < competitors.length; i++)  {
//                accumulator.push(competitors[i]);
//
//              }
//            }
//            
//          });
//        });
            
//	var competitors = docs[0].competitors.split(',');
        
//	accumulator.push(docs[0]);

//    });

//});
//	collection.find({companyName: {$in: competitors}}, function (err, docs) {
//if (err) {
//  console.log(err);
//}
//if(docs.length > 0) {
//  accumulator.push(docs);
//}
//
//res.json({result: accumulator});
//
//		});
//	});
//
//});
app.get('/uiContent', function (req, res) {
    var db = mongojs('localhost:27017/glassdoor');
    var collection;

    if(!req.query || !req.query.name) {
      res.json({data:[]});
      db.close();
      return;
    }

    collection = db.collection('uiContent');

    collection.find({companyName: req.query.name}, function (err, docs) {
      if(docs.length === 0) {
        res.json({data:[]});
        db.close();
        return;
      }

      res.json({data: docs});
      db.close();

    });
});


app.get('/interactionPoints', function (req, res) {
    var db = mongojs('localhost:27017/glassdoor');
    var collection;

    if(!req.query || !req.query.name) {
      res.json({data:[]});
      db.close();
      return;
    }

    collection = db.collection(req.query.name);

    collection.find({}, {
      'interactionPoint': 1,
      'time': 1,
      'oldCount': 1,
      'newCount': 1,
      '_id':0
    }).sort({
      'time': 1
    }, function (err, docs) {
      if(docs.length === 0) {
        res.json({data:[]});
        db.close();
        return;
      }

      res.json({
        data: docs
      });
      db.close();

    });
});

app.get('/companies', function (req, res) {
    var db = mongojs('localhost:27017/glassdoor');
    var collection = db.collection('uiContent');

    collection.find({}, {companyName: 1}, function (err, docs) {
        var accumulator = [];
        for (var i in docs) {
            accumulator.push(docs[i].companyName);
        }
        res.json({companies: accumulator});
        db.close();
    });
});

app.set('port', 3001);

var server = http.createServer(app);
server.listen(3001);
