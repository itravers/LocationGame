// routes/routes.js

//used by socket.io to allow client to connect to server, this must change
//if domain changes, or when we move from dev server to live
var hostedAddress = "http://192.168.1.197";
//var hostedAddress = "http://quiz.chicosystems.com";

// load up the quizQestions model
var Distance = require('geo-distance');
var Locations            = require('../models/locations');
var Users = require('../models/user');
var Cities            = require('../models/cities');
var Venues            = require('../models/venues');
var util = require('util');
var ObjectId = (require('mongoose').Types.ObjectId);

module.exports = function(app, passport){

  //==============================================
  //Game Routes
  //==============================================


  app.get('/designtest', function(req, res){
    functionTest();
    res.render('designTest.ejs', {title : "Design Test"});
  });

  app.get('/privacy', function(req, res){
    res.render('privacy.ejs', {
      title : "Location Game - Privacy",
      user : req.user  
    });
  });

  app.get('/designtest2', function(req, res){
    res.render('designTest2.ejs', {title : "Design Test 2"});
  });

  app.get('/jquestion', function (req, res){
    renderJQuestion(req, res);
  });

  app.get('/', function(req, res){
    res.redirect('/console');
  });

  //this is the main user console
  app.get('/console', function(req, res){
    if(req.user){
      req.user.company_value = req.user.portfolio_value + req.user.cash_on_hand + req.user.cash_tied_up;
      req.user.level = calculateLevel(req.user.portfolio_value);
      req.user.portfolio_next_value = calculateNextPortfolioValue(req.user.level);
      req.user.cash_on_hand_limit = calculateCashOnHandLimit(req.user.level);
      console.log("companyValue: " + req.user.company_value);
      if(req.user.cash_on_hand > req.user.cash_on_hand_limit){
        req.user.cash_on_hand = req.user.cash_on_hand_limit;
      }
      req.user.save();
      res.render('console.ejs', {
        title : "Console",
        user : req.user
      });
    }else{
      res.redirect('/login');
    }
  });

  //The buy properties page, user can see all local properties
  app.get('/buyproperties', function(req, res){
    var lat = 41.08749;
    var longi = -122.717445;
    var miles = 1000;
    if(req.user){
      //first lets find a list of cities
      Cities.find({location: { $geoWithin: { $centerSphere: [[longi, lat], miles / 3963.2]}}},{},).exec(function(err, results){
        if(err) throw err;
        //now we want to sort results based on location
        var myLoc = {lat: lat, lon: longi};
        console.log("sorting cities...");
        results = mergeSort(results, myLoc);
        console.log("done sorting cities");
        res.render('buyproperties.ejs', {
          title : "Buy Properties",
          user  : req.user,
          results : results
        });

      });
      
    }else{
      res.redirect('/login');
    }
  });

  //specific buy property page
  app.get('/buyproperty/:propertyid', function(req, res){
    var propertyid = req.params.propertyid;
    //var object = new ObjectId(propertyid);
    if(req.user){
      //Cities.find( {_id: new ObjectId(propertyid)}, {}).exec(function(err, results){
      Cities.findOne({_id: new ObjectId(propertyid)}, {}, function(err, results){
        if(err) throw err;
        console.log(results);
        res.render('buyproperty.ejs', {
          title : "Buy " + results.city_name,
          user  : req.user,
          results : results
        });
      });
    }else{
      res.redirect('/login');
    }
  });

  //The main page, renders jquestion or quizquestion half time
  app.get('/:latitude/:longitude/:miles', function(req, res){
     var lat = parseFloat(req.params.latitude);
     var longi = parseFloat(req.params.longitude);
     var miles = parseInt(req.params.miles);
     Cities.find({location: { $geoWithin: { $centerSphere: [[longi, lat], miles / 3963.2]      }    }  }, {}, ).exec(function(err, results){
      if(err) throw err;

      //here we want to sort results based on closest distance from latitude and longitude
      var myLoc = {
        lat: lat,
        lon: longi
      };

      console.log("sorting...");
      //results = selectionSort(results, myLoc);
      results = mergeSort(results, myLoc);
      console.log("done sorting");

      res.render('index.ejs',{
        title: "Quiz Game Scoreboard",
        results: results,
        user: req.user
      });
    });
  });

  app.get('/mapTest', function(req, res){
    res.render('mapTest.ejs',{
      title: "Map Test",
    });
  });

  app.get('/scoreboard', function(req, res, done){
    Users.find({}, {}, ).exec(function(err, results){
      if(err) throw err;

      res.render('scoreboard.ejs',{
        title: "Scoreboard",
        results: results,
        user: req.user
      });
    });
  });

  //resets the score of the signed in user
  app.get('/resetscore', function(req, res, done){
    if(req.user){
      req.session.score = 0;
      req.user.gameinfo.score = 0;
      
      req.user.save();
      res.send({
        message: "Score Reset",
        score  : req.session.score
      });
    }
  });

  //deletes the question history of the signed in user
  app.get('/deletequestionhistory', function(req, res, done){
    if(req.user){
      req.user.questionHistory = [];
      req.user.save();
      res.send({
        message: "Question History Deleted"
      });
    }
  });

  //user sets the difficulty in their profile page
  app.get('/setdifficulty/:newdiff', function(req, res){
    if(req.user){
      req.user.difficulty = req.params.newdiff;
      req.user.save();
      res.send({message: "Successfully Changed Difficulty"});
    }else{
      res.send({message: "Error, not logged in, can't change difficulty"});
    }
  });

  app.get('/removereport/:id', function(req, res){
    if(req.user && req.user.permissions.admin && req.user.permissions.viewReports){

      ReportProblem.remove({ id: req.params.id }, function(err) {
        if (!err) {
          res.send({status: "success", message: "Report " + req.params.id + " removed!"});
        }else {
          res.send({status: "error", message: "Err: " + err});
        }
      });

    }else{
      res.send({status: "error", message: "User Does Not Have Permissions To Remove Report"});
    }
  });

  //reports a problem with a question to the admin
  app.post('/reportproblems', function(req, res){
    var id = req.body.id;
    var problem = req.body.problem;
    var questionType = req.body.questionType;
    var newProblem = new ReportProblem();
    newProblem.id = id;
    newProblem.problem = problem;
    newProblem.questionType = questionType;
    
    console.log("reporting problem: " + newProblem); 
 
    //save the new problem
    newProblem.save();
  });

  //lets client know if it is logged in, used by multiplayer
  app.get('/isloggedin', function(req, res){
    if(req.user){
      res.send("true");
    }else{
      res.send("false");
    }
  });

  //client playing multiplayer redeems their bonus
  app.post('/redeembonus', function(req, res){
    if(req.user){
      var bonus = parseInt(req.body.bonus);
      console.log("redeeming bonus of " + bonus);
      req.user.gameinfo.score = req.user.gameinfo.score + bonus;
      req.user.save();
    }else{
      console.log("can't redeem bonus for user not signed in");
    }
  });

  //=============================================
  // Admin Routes
  //============================================
  
  //admin page
  app.get('/admin', function(req, res){
    //check if user is an admin
    if(req.user && req.user.permissions.admin){
      ReportProblem.find({}, {}, function(err, results){
        if(err) throw err;
        //console.log(results);
  
        //get a list of all the users
        Users.find({}, {}, function(error, users){
          if(error)throw error;

          console.log("users: " + users);
          res.render('admin.ejs', {
            title: "Admin",
            user: req.user,
            users: users,
            reports: results
          });
        });
      });
    }else{
      res.redirect('/login');
    }
  });

  app.get('/edituser/:userID/:admin/:editQuestions/:viewReports/:editUsers', function(req, res){
    //check if user is an admin, and has editUsers permission
    if(req.user && req.user.permissions.admin && req.user.permissions.editUsers){
      //user has permissions, update the user given by id
      Users.findOne({_id: new ObjectId(req.params.userID)}, {}, function(err, results){
        console.log(results);
        results.permissions.admin = req.params.admin;
        results.permissions.editQuestions = req.params.editQuestions;
        results.permissions.viewReports = req.params.viewReports;
        results.permissions.editUsers = req.params.editUsers;
        results.save();
        res.send({status: "success", message: "user was found"});
      });
    }else{
      res.send({status: "error", message: "User Does Not Have Permission to Edit Users"});
    }
  });

    


  //============================================
  // MultiPlayer Related Routes
  //============================================

  app.get('/lobby', function(req, res){
    //get userName
    var name = "guest"+ (Math.floor((Math.random() * 1000) + 1));

    if(req.user){
      if(req.user.facebook.name != null){
        name = req.user.facebook.name;
      }else if(req.user.twitter.username){
        name = req.user.twitter.username;
      }else if(req.user.google.name){
        name = req.user.google.name;
      }else if(req.user.local.email){
        name = req.user.local.email;
      }
    }
    var clientConnectTo = hostedAddress +":"+ app.server.address().port;
    if(req.user){
      res.render('lobby.ejs', {
        title: "Multi Player Lobby",
        serverIP: clientConnectTo,
        user    : req.user,
        name    : name,
        id      : req.user._id
      });
    }else{
      res.redirect('/login');
    } 
  });

  //==============================================
  //Social Login Routes
  //=============================================
  
  //Login Page
  app.get('/login', function(req, res){
    //render the page, and pass in flash data, if it exists
    res.render('login.ejs', {
      message: req.flash('loginMessage'),
      title: "Quiz Game Login"
    });
  });

  //process the login form
  app.post('/login', passport.authenticate('local-login',{
    successRedirect : '/console',
    failureRedirect : '/login',
    failureFlash     : true
  }));

  //Signup Page
  app.get('/signup', function(req, res){
    res.render(
      'signup.ejs',{
        message: req.flash('signupMessage'),
        title: "Quiz Game Signup"
    });
  });

  //process the signup form
  app.post('/signup', passport.authenticate('local-signup', {
    successRedirect : '/', //redirect to secure profile section
    failureRedirect : '/signup',  //redirect to signup page with error
    failureFlash    : true        //allow flash messages
  }));

  //Profile Section
  // We want user logged in to visit
  // use route middleware to verify this (isLoggedIn function)
  app.get('/profile', isLoggedIn, function(req, res){

      res.render(
        'profile.ejs',{ 
          user: req.user,
          title: "Quiz Game - Profile"
        } //get the user out of session and pass to template
      );

  });

  //=========
  //Facebook routes
  //=========
  
  //route for facebook auth and login
  app.get('/auth/facebook', passport.authenticate('facebook', {
    scope : ['public_profile', 'email']
  }));

  //handle the callback after facebook has authenticated the user
  app.get('/auth/facebook/callback',
    passport.authenticate('facebook', {
      successRedirect : '/',
      failureRedirect : '/login'
  }));

  //==============
  //Twitter Routes
  //==============
  
  //route for twitter auth and login
  app.get('/auth/twitter', passport.authenticate('twitter'));

  //handle the callback after twitter has auth'd the user
  app.get('/auth/twitter/callback',
    passport.authenticate('twitter', {
      successRedirect : '/',
      failureRedirect : '/login'    
  }));

  //=============
  //Google Routes
  //=============

  //route for google auth and login
  app.get('/auth/google', passport.authenticate('google', {
    scope : ['profile', 'email']
  }));

  //handle the callback after google has auth'd the user
  app.get('/auth/google/callback',
    passport.authenticate('google', {
      successRedirect : '/',
      failureRedirect : '/login'
    }
  ));

  //===========================
  //Authorize (Already Logged In / Connecting Other Social Account
  //===========================

  //local connect
  app.get('/connect/local', function(req, res){
    res.render('connect-local.ejs', {message: req.flash('loginMessage')});
  });

  app.post('/connect/local', passport.authenticate('local-signup', {
    successRedirect : '/profile',
    failureRedirect : '/connect/local',
    failureFlash : true
  }));

  //facebook connect
  //send to facebook to do the auth
  app.get('/connect/facebook', passport.authorize('facebook', {
    scope: ['public_profile', 'email']
  }));

  //handle the callback after facebook has auth'd the user
  app.get('/connect/facebook/callback',
    passport.authorize('facebook', {
      successRedirect : '/profile',
      failureRedirect : '/'
  }));

  //twitter connect
  //send to twitter to do the auth
  app.get('/connect/twitter', passport.authorize('twitter', {scope: 'email'}));

  //handle the callback after twitter auth'd the user
  app.get('/connect/twitter/callback',
    passport.authorize('twitter', {
      successRedirect : '/profile',
      failureRedirect : '/'
  }));

  //google connect
  //send to google to do the auth
  app.get('/connect/google', passport.authorize('google', {scope :['profile', 'email']}));

  //callback after google auth'd user
  app.get('/connect/google/callback',
    passport.authorize('google', {
      successRedirect : '/profile',
      failureRedirect : '/'
  }));

  //==========================================
  //Unlink Routes
  //==========================================
  //for social accounts just remove token
  //for local account remote email and password

  //local unlink
  app.get('/unlink/local', function(req, res){
    var user = req.user;
    user.local.email = undefined;
    user.local.password = undefined;
    user.save(function(err){
      res.redirect('/profile');
    });
  });

  //facebook unlink
  app.get('/unlink/facebook', function(req, res){
    var user = req.user;
    user.facebook.token = undefined;
    user.save(function(err){
      res.redirect('/profile');
    });
  });

  //twitter unlink
  app.get('/unlink/twitter', function(req, res){
    var user = req.user;
    user.twitter.token = undefined;
    user.save(function(err){
      res.redirect('/profile');
    });
  });

  //google unlink
  app.get('/unlink/google', function(req, res){
    var user = req.user;
    user.google.token = undefined;
    user.save(function(err){
      res.redirect('/profile');
    });
  });

  //Logout
  app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });

  //route middleware to make sure a user is logged in
  function isLoggedIn(req, res, next){
    //if user is authenticated in the session, keep going
    if(req.isAuthenticated()){
      return next();
    }else{
      //if they aren't redirect them to home page
      res.redirect('/');
    }
  }
};

//===============================================
// Functions used by routes
//==============================================




function functionTest(){
  console.log("functionTEST CALLED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
}

function swap(results, firstIndex, secondIndex){
  var temp = results[firstIndex];
  results[firstIndex] = results[secondIndex];
  results[secondIndex] = temp;
}

function selectionSort(results, myLoc){
  console.log("sorting...");
  var len = results.length;
  var min;

  for(var i = 0; i < len; i++){
    min = i;
    if(i % 500 == 0)console.log("Sorting Record " + i);

    for(var j = i + 1; j < len; j++){
      var propLoc1 = {
          lat: results[j].lat,
          lon: results[j].longi
      }

      var propLoc2 = {
        lat: results[min].lat,
        lon: results[min].longi
      }

      var distance1 = Distance.between(myLoc, propLoc1);
      var distance2 = Distance.between(myLoc, propLoc2);
      if(distance1 < distance2){
        min = j;
      }
    }
    
    if(i != min){
      swap(results, i, min);
    }
  }
  console.log("Done Sorting!");
  return results;
}

function mergeSort (arr, myLoc) {
    if (arr.length < 2) {
      return arr;
    }

    var mid = Math.floor(arr.length / 2);
    var subLeft = mergeSort(arr.slice(0, mid), myLoc);
    var subRight = mergeSort(arr.slice(mid), myLoc);


    return merge(subLeft, subRight, myLoc);
}

function merge (node1, node2, myLoc) {
    var result = [];
    while (node1.length > 0 && node2.length > 0){
         var propLoc1 = {
           lat: node1[0].lat,
           lon: node1[0].longi
         }
          var propLoc2 = {
            lat: node2[0].lat,
            lon: node2[0].longi
          }

         var distance1 = Distance.between(myLoc, propLoc1);
         var distance2 = Distance.between(myLoc, propLoc2);
         node1[0].distance = distance1;
         node2[0].distance = distance2;
         node1[0].val = calculateValue(node1[0]);
         node2[0].val = calculateValue(node2[0]);
         result.push(distance1 < distance2? node1.shift() : node2.shift());
    }
    return result.concat(node1.length? node1 : node2);
}

function calculateValue(node){
  var baseValue = 10000;


  var val = baseValue * 1;
  return val;
}


//returns the company_value needed to get to the next level
function calculateCashOnHandLimit(level){
  var nextValue = calculateNextPortfolioValue(level) /2;
  return nextValue;
}

//returns the company_value needed to get to the next level
function calculateNextPortfolioValue(level){
  var nextValue = 0;
  switch(level){
    case 0:
      nextValue = 10000;
    break;
    case 1:
      nextValue = 50000;
    break;
    case 2:
      nextValue = 120000;
    break;
    case 3:
      nextValue = 300000;
    break;
    case 4:
      nextValue = 500000;
    break;
    case 5:
      nextValue = 750000;
    break;
    case 6:
      nextValue = 1200000;
    break;
    case 7:
      nextValue = 3000000;
    break;
    case 8:
      nextValue = 5000000;
    break;
    case 9:
      nextValue = 7000000;
    break;
    case 10:
      nextValue = 10000000;
    break;
    case 11:
      nextValue = 50000000;
    break;
    case 12:
      nextValue = 75000000;
    break;
    case 13:
      nextValue = 100000000;
    break;
    case 14:
      nextValue = 1000000000;
    break;
    case 15:
      nextValue = 5000000000;
    break;
  }
  console.log("next_value: " + nextValue);
  return nextValue;
}

//returns the level based on the portfolio value
function calculateLevel(company_value){
  var level = 0;
  if(company_value >= 0 && company_value < 10000){
    level = 0;
  }else if(company_value >= 10000 && company_value < 50000){
    level = 1;
  }else if(company_value >= 50000 && company_value < 120000){
    level = 2;
  }else if(company_value >= 120000 && company_value < 300000){
    level = 3;
  }else if(company_value >= 300000 && company_value < 500000){
    level = 4;
  }else if(company_value >= 500000 && company_value < 750000){
    level = 5;
  }else if(company_value >= 750000 && company_value < 1200000){
    level = 6;
  }else if(company_value >= 1200000 && company_value < 3000000){
    level = 7;
  }else if(company_value >= 3000000 && company_value < 5000000){
    level = 8;
  }else if(company_value >= 5000000 && company_value < 7000000){
    level = 9;
  }else if(company_value >= 7000000 && company_value < 10000000){
    level = 10;
  }else if(company_value >= 10000000 && company_value < 50000000){
    level = 11;
  }else if(company_value >= 50000000 && company_value < 75000000){
    level = 12;
  }else if(company_value >= 75000000 && company_value < 100000000){
    level = 13;
  }else if(company_value >= 100000000 && company_value < 1000000000){
    level = 14;
  }else{
    level = 15;
  }
  return level;
}
