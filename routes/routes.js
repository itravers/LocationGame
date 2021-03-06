// routes/routes.js

//used by socket.io to allow client to connect to server, this must change
//if domain changes, or when we move from dev server to live
var hostedAddress = "http://192.168.1.197";
//var hostedAddress = "http://quiz.chicosystems.com";

// load up the quizQestions model
var Distance = require('geo-distance');
//var Locations            = require('../models/locations');
var Users = require('../models/user');
var Cities            = require('../models/cities');
//var Venues            = require('../models/venues');
var util = require('util');
var ObjectId = (require('mongoose').Types.ObjectId);
var schedule = require('node-schedule');
var ticks = 0;

var pjson = require('../package.json');

var j = schedule.scheduleJob('* * * * *', function(){
  var delayTime = 15000;
  timeStep(1);
/*  delay(function(){
    timeStep();
    delay(function(){
      timeStep();
      delay(function(){
        timeStep();
      }, delayTime ); // end delay
    }, delayTime ); // end delay
  
  }, delayTime ); // end delay
*/
});

var delay = ( function() {
    var timer = 0;
    return function(callback, ms) {
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
    };
})();

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

  //this is the store, where the user can make in game purchases
  app.get('/store', function(req, res){
    if(req.user){
      res.render('store.ejs', {
        title : "Store",
        user : req.user
      });
    }else{
      res.redirect('/login');
    }
  });
 
  //this is the user trying to incrementCashOnHandLimitBonus
  //which is the bonus that increases the amount of 
  //cash a user can have on hand at one time.
  app.post('/store/incrementcashonhandlimitbonus/:userID', function(req, res){
    if(req.user){
      var userID = req.params.userID;
      Users.findOne({_id: new ObjectId(userID)}, {}, function(err, userR){
        if(err || !userR){
           res.send({status: "error", message: "User Not Found!"});
           return;
        }
        if(req.user.groupies >= 20){
          req.user.groupies -= 20;
          userR.cash_on_hand_bonus_limit += .01;
          req.user.save();
          userR.save();
          var cash_on_hand_limit = calculateCashOnHandLimit(userR.level, userR.cash_on_hand_bonus_limit);
          res.send({
             status: "success",
             message: "You Purchased Incremented Your Cash Limit",
             groupies: userR.groupies,
             newLimit: userR.cash_on_hand_bonus_limit,
             cash_on_hand_limit: cash_on_hand_limit
          });
        }else{
          res.send({status: "error", message: "You do not have 20 groupies!"});
        }
      });
    }else{
      res.send({status: "error", message: "User Not Signed In!"});
    }
  });
 
  //this is the user trying to buy an item from the store
  app.post('/store/buyitem/:itemName/:numItems', function(req, res){ 
    if(req.user){
      var itemName = req.params.itemName;
      var numItems = parseInt(req.params.numItems);
      console.log(req.user.company_name + " buying " + numItems + " " + itemName);
      
      //right here is where we will use an api to buy a product through
      //an app store

      //but for now we will say it is a success
      var purchaseSuccess = true;
      if(isNaN(numItems)) purchaseSuccess = false;

      if(purchaseSuccess){
        req.user.groupies += numItems;
        req.user.save();

      

        res.send({status: "success", message: "You Purchased: " + numItems + " " + itemName, groupies: req.user.groupies});
      }else{
        res.send({status: "error", message: "Your Purchase did NOT go through!"});
      }

    }else{
      res.send({status: "error", message: "User Not Signed In!"});
    }
  });

  //this is the main user console
  app.get('/console', function(req, res){
    //console.log("called /console");
    //console.log("req.user: " + req.user);
    if(req.user){
      var datetime = new Date();
      console.log(datetime);
      req.user.last_online = datetime;
      req.user.company_value = req.user.portfolio_value + req.user.cash_on_hand + req.user.cash_tied_up;
      req.user.level = calculateLevel(req.user.portfolio_value);
      req.user.portfolio_next_value = calculateNextPortfolioValue(req.user.level);
      req.user.cash_on_hand_limit = calculateCashOnHandLimit(req.user.level, req.user.cash_on_hand_bonus_limit);
      req.user.save();
      res.render('console.ejs', {
        title : "Console",
        user : req.user,
        userR : null,
        ticks: ticks,
        version: pjson.version
      });
    }else{
      res.redirect('/login');
    }
  });

  //this is the console where you can view anyone's console.
  app.get('/console/:userID', function(req, res){
  
  
    var userID = req.params.userID;
    //userID = "5c3935102355ad18bf0504c7";
    //console.log("userID: " + userID);
    //console.log("req.user.: " + userID);
    Users.findOne({_id: new ObjectId(userID)}, {}, function(err, userR){
    
      if(req.user){
        if(userR){
          userR.company_value = userR.portfolio_value + userR.cash_on_hand + userR.cash_tied_up;
          userR.level = calculateLevel(userR.portfolio_value);
          userR.portfolio_next_value = calculateNextPortfolioValue(userR.level);
          userR.cash_on_hand_limit = calculateCashOnHandLimit(userR.level, userR.cash_on_hand_bonus_limit);
          userR.save();
          res.render('console.ejs', {
            title : "Console",
            user : req.user,
            userR : userR, //The user who's information we are looking up in the console.
            ticks: ticks,
            version: pjson.version
          });
        }
      }else{
        res.redirect('/login');
      }
    });
  });

  //The buy properties page, user can see all local properties
  app.get('/buyproperties', function(req, res){
    var lat = 41.08749;
    var longi = -122.717445;
    //var lat = 34.002503;
    //var longi = -118.239809;
    var miles = 400;
    if(req.user){
      //first lets find a list of cities
      Cities.find({location: { $geoWithin: { $centerSphere: [[longi, lat], miles / 3963.2]}}},{},).exec(function(err, results){
        if(err) throw err;
       
      
        //now we want to sort results based on location
        var myLoc = {lat: lat, lon: longi};
        //console.log("sorting cities...");
        results = mergeSort(results, myLoc);
        //console.log("done sorting cities");
        //limit the length of the results, this will be a skill
        results.length = 300;
        for(var i = 0; i < results.length; i++){ 
          results[i].property_cost = calculateCityValue(results[i]);
        } 

        //loop through all the cities in results, checking if we already own it
        //if we do own the city we will put it aside and then add it to the front 
        //of results after we are done
        var citiesOwned = new Array();
        for(var i = 0; i < results.length; i++){
          if(doesUserOwnCity(req.user, results[i])){
            citiesOwned.push(results[i]);
          }
        }      

        //reverse citiesOwned
        citiesOwned.reverse();
  
        //remove all cities from filteredResults that we own
        var filteredResults = results.filter(function(value, index, arr){
          if(!citiesOwned.includes(value)){
            return true;
          }
        });

        //add all cities we own to the front of filtered results
        for(var i = 0; i < citiesOwned.length; i++){
          filteredResults.unshift(citiesOwned[i]);
        }

//        console.log("cities owned: " + citiesOwned);
 
        res.render('buyproperties.ejs', {
          title : "Buy Properties",
          user  : req.user,
          results : filteredResults
        });

      });
      
    }else{
      res.redirect('/login');
    }
  });

  //view a list of property owners, with how much they own
  //of each property
  app.get('/viewowners/:propertyid', function(req, res){
    var propertyid = req.params.propertyid;
    if(req.user){//user is logged in
      
      Cities.findOne({_id: new ObjectId(propertyid)}, {}, function(err, city){
      //unfortunately we store all property ownership info
      //in the users database under user.property.owned
      //which is an array with each item being 
      //a property with percent_owned, property_id, total_earned
      //we need to query all users, loop through them,
      //in an inner loop we loop through all properties owned & comp.
      Users.find({}, {}, ).exec(function(err, users){
       // console.log(users);
        var total_owned = 0;
        var owners = new Array(); //we will build a list of owners
        //loop through users
        for(var i = 0; i < users.length; i++){
          var thisuser = users[i];
          //loop through each user.property.owned
          for(var j = 0; j < thisuser.property.owned.length; j++){
            //compare property id's
            var property = thisuser.property.owned[j];
            if(property.property_id == propertyid){
              var owner = {"_id" : thisuser._id,
                           "company_name": thisuser.company_name,
                           "percent_owned": property.percent_owned,
                           "total_earned" : property.total_earned};
              owners.push(owner);
              total_owned += property.percent_owned;
             // console.log(user.company_name + " owns " + property.percent_owned + "% of property and has earned $" + Math.round(property.total_earned));
            }
          }
        }
        console.log(owners);

        //render here
        res.render('viewowners.ejs', {
                title : city.city_name + " City Owners",
                city : city,
                user: req.user,
                owners: owners,
                total_owned: total_owned
        }); 
      });//end Users.find
      });//end Cities.find

    }else{//user not logged in
      res.redirect('/login');
    }
  });


  app.get('/scoreboard', function(req, res, done){
    var dateTime = new Date();
    var sortMethod = {portfolio_value: -1};
    Users.find({}, {}, ).sort(sortMethod).exec(function(err, results){
      if(err) throw err;
      
      //console.log(results[0]);

      res.render('scoreboard.ejs',{
        title: "Scoreboard",
        results: results,
        user: req.user,
        dateTime: dateTime
      });
    });
  });

  //view a property page, with option to buy it
  app.get('/viewproperty/:propertyid', function(req, res){
    var propertyid = req.params.propertyid;
    if(req.user){
      Cities.findOne({_id: new ObjectId(propertyid)}, {}, function(err, results){
        if(err) throw err;
        
        var already_own = false;
        for(var i = 0; i < results.owners.length; i++){
          //see if user id is == to owner.id
          if(results.owners[i].owner_id == req.user._id){
            //we already own a share, let just add to it
            //results.owners[i].percent_owned += shares;
            already_own = true;
            break;
          }
        }

        results.property_cost = calculateCityValue(results);
        res.render('viewproperty.ejs', {
          title : "View " + results.city_name,
          user  : req.user,
          already_own : already_own,
          results : results,
          buyTrueSellFalse: true
        });
      });
    }else{
      res.redirect('/login');
    }
  });

  //view a property page to sell it
  app.get('/viewsellproperty/:propertyid', function(req, res){
    var propertyid = req.params.propertyid;
    if(req.user){
      Cities.findOne({_id: new ObjectId(propertyid)}, {}, function(err, results){
        if(err) throw err;
        results.property_cost = calculateCityValue(results);
        res.render('viewproperty.ejs', {
          title : "View " + results.city_name,
          user  : req.user,
          results : results,
          buyTrueSellFalse: false
        });
      });
    }else{
      res.redirect('/login');
    }
  });

  /*user decided to sell shares of a property
  */
  app.get('/sellproperty/:propertyid/:shares', function(req, res){
    //get parameters
    var propertyid = req.params.propertyid;
    var sharesToSell = parseFloat(req.params.shares);
    var sharesOwned = 0;
    //find shares of this property the user already owns
    if(req.user){
      for(var i = 0; i < req.user.property.owned.length; i++){
        if(propertyid == req.user.property.owned[i].property_id){
          sharesOwned = req.user.property.owned[i].percent_owned;
        }
      }
    }
   
    //console.log("sharesOwned:  " + sharesOwned);
    //console.log("sharesToSell: " + sharesToSell);
 
    if(!req.user){ //make sure user is signed in
      //user is not signed in, send error
      res.send({status: "error", message: "User Not Signed In!"});
    }else if(sharesOwned < sharesToSell){ //check user has shares to sell
      res.send({status: "error", message: "sharesOwned: " + sharesOwned + " sharesToSell: "+sharesToSell });
    }else{
      Cities.findOne({_id: new ObjectId(propertyid)}, {}, function(err, results){
        //process request
        if(err){
          res.send({status: "error", message: "City Not Available"});
          return;
        }
        
        //console.log(" premodify req.user.property.owned " + req.user.property.owned);      

        //1. modify user
        //loop through user.property.owned and remove any matches
        for(var i = 0; i < req.user.property.owned.length; i++){
          if(req.user.property.owned[i].property_id == propertyid){
            if(sharesToSell == sharesOwned){
              //we found a match, remove it from the array
              req.user.property.owned.splice(i, 1);
              //decrease properties owned
              req.user.property.total_properties -= 1;
              break;
            }else{
              //we found a match, change percent owned
              req.user.property.owned[i].percent_owned -= sharesToSell;
              break;
            }
          }
        } 
      

        var city_value = calculateCityValue(results);
        var cost_per_share = city_value / 100;
        var cost = cost_per_share * sharesToSell;
       
         //change portfolio_value
        req.user.portfolio_value = req.user.portfolio_value - cost;

        //change cash value
        req.user.cash_on_hand = req.user.cash_on_hand + cost;

        req.user.save(function(err){
          if(err){
            res.send({status: "error", message: "City Not Available"});
            return;
          }
          //2. modify property
          //loop through result.owners and remove match
          for(var i = 0; i < results.owners.length; i++){
            if(req.user._id == results.owners[i].owner_id){
              if(sharesToSell == sharesOwned){
                //we have a match, remove it
                results.owners.splice(i, 1);
                break;
              }else{
                results.owners[i].percent_owned -= sharesToSell;
                break;
              }
            } 
          }
          results.percent_owned = results.percent_owned - sharesToSell;
          results.save(function(err){
            if(err){
              res.send({status: "error", message: "City Not Available"});
              return;
            }
            res.send({status: "success", message: "Success!"});
          });
        });
      });
    }
  });

  //user decided to buy a property, clicks buy button (backend)
  app.get('/buyproperty/:propertyid/:shares', function(req, res){
    var propertyid = req.params.propertyid;
    var shares = parseFloat(req.params.shares);
    if(req.user){
      Cities.findOne({_id: new ObjectId(propertyid)}, {}, function(err, results){
        if(err){
           res.send({status: "error", message: "City Not Available"});
        }else{
          //no error, city is found
          //check if user can afford this many shares of property
          var city_value = calculateCityValue(results);
          var price_per_share = city_value / 100;
          var purchase_price = price_per_share * shares;
          var cash_on_hand = req.user.cash_on_hand;
          var totalPropertiesOwned = req.user.property.total_properties;
          var maxProperties = req.user.property.max_properties;
          var totalPending = req.user.property.total_pending;
          var maxPending = req.user.property.max_pending;
            
          //we go through all owers of the property, already own it we
          //add the amount we've just purchased.
          var already_own = false;
          for(var i = 0; i < results.owners.length; i++){
            //see if user id is == to owner.id
            if(results.owners[i].owner_id == req.user._id){
              //we already own a share, let just add to it
              results.owners[i].percent_owned += shares;
              already_own = true;
              break;
            }
          }

          if(results.percent_owned + shares > 100){
              res.send({status: "error", message: "That many shares not available"});
              console.log("error That many shares not available");
          }else if(totalPropertiesOwned >= maxProperties && already_own == false){
            res.send({status: "error", message: "Cannot Exceed Maximum Properties!"});
            console.log("error purchasing, cannot exceed maximum properties!");
          }else if(purchase_price <= cash_on_hand){
            //first we create a new owner record in the property that is bought
            var newOwner = {
              owner_id  : req.user._id,
              percent_owned : shares
            };
/*
            //we go through all owers of the property, already own it we
            //add the amount we've just purchased.
            var already_own = false;
            for(var i = 0; i < results.owners.length; i++){
              //see if user id is == to owner.id
              if(results.owners[i].owner_id == req.user._id){
                //we already own a share, let just add to it
                results.owners[i].percent_owned += shares;
                already_own = true;
                break;
              }
            }
*/
            //if we don't already own it, we save the newOwner record
            if(!already_own){
              results.owners.push(newOwner);
            }
          
            //now we calculate the percent_owned for the city
            var percent_owned = 0;
            for(var i = 0; i < results.owners.length; i++){
              percent_owned += results.owners[i].percent_owned;
            }
            results.percent_owned = percent_owned;
                      
            results.save(function(err){
              //res.redirect('/profile');
              //now we add the property record to the user
              already_own = false;
              for(var i = 0; i < req.user.property.owned.length; i++){
                //check to make sure we don't already own this
                if(req.user.property.owned[i].property_id == results._id){
                  req.user.property.owned[i].percent_owned += shares;
                  already_own = true;
                } 
              }
  
              //the user does not already own the property. create and save new re
              if(!already_own){
                //now we create a new property.owned record for the user
                var newPropertyOwned = {
                  property_id  : results._id,
                  percent_owned : shares,
                  total_earned  : 0
                };  

                req.user.property.owned.push(newPropertyOwned);
                req.user.property.total_properties = req.user.property.total_properties + 1;
                
              }
              //increase user.portfolio_value by amound purchased
              req.user.portfolio_value += purchase_price;
              req.user.cash_on_hand -= purchase_price;
              req.user.save(function(err){
                res.send({status: "success", message: "You've Purchased It", results: results, results2: req.user});
              });
            });
  
          }else{
            res.send({status: "error", message: "You Cannot Afford That!"});
          }
        }
      });
    }else{
      res.send({status: "error", message: "Not Signed In"});
    }
  }); 

  app.get('/portfolio/:userID', function(req, res){
    var lat = 41.08749;
    var longi = -122.717445;

    //var userID = "5c3935102355ad18bf0504c7";
    var userID = req.params.userID;
    //find userR here
    
    if(req.user){
      Users.findOne({_id: new ObjectId(userID)}, {}, function(err, userR){
        if(!userR) userR = req.user;
        var ids = [];
        //get id's of properties owned
        for(var i = 0; i < userR.property.owned.length; i++){
          ids.push(userR.property.owned[i].property_id);
        }
        var obj_ids = ids.map(function(id) { return ObjectId(id); });
    
        Cities.find({_id: {$in: obj_ids}},{},).exec(function(err, results){
          var myLoc = {lat: lat, lon: longi};
          //console.log("sorting cities...");
          results = mergeSort(results, myLoc);
          //console.log("done sorting cities");
  
          //double loop, matching user.property.owned[j] to results[i]
          var amountIOwn = [];
          var totalEarned = [];
          var propertyCost = [];// = calculateCityValue(results);
          for(var i = 0; i < results.length; i++){
            for(var j = 0; j < userR.property.owned.length; j++){
              //find a matching propertyid
              if(results[i]._id == userR.property.owned[j].property_id){
                //console.log("totalEarned: " + userR.property.owned[j].total_earned); 
                amountIOwn.push(userR.property.owned[j].percent_owned);
                totalEarned.push(userR.property.owned[j].total_earned);
                propertyCost.push(calculateCityValue(results[i]));
                break;
              }
            } 
          }
          //console.log("amountIOwn: " + amountIOwn);
          res.render('portfolio.ejs',{
            title: "Portfolio",
            results: results,
             user: req.user,
             userR: userR,
             amountIOwn: amountIOwn,
             totalEarned: totalEarned,
             propertyCost: propertyCost
           });
         });
      });
     

    }else{
      res.redirect('/login');
    }
  });

  app.get('/simulateTimeStep/:numsteps', function(req, res){
    var numsteps = parseInt(req.params.numsteps);
    timeStep(numsteps);
    res.send(numsteps + " tick[s] done");
  });

/*
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

*/
  app.get('/mapTest', function(req, res){
    res.render('mapTest.ejs',{
      title: "Map Test",
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
    
    //console.log("reporting problem: " + newProblem); 
 
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
      title: "Location Game Login"
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
  //console.log("sorting...");
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
function calculateCashOnHandLimit(level, cash_on_hand_bonus_limit){
  var divisor = 1;
  if(level < 2){ 
    divisor = 1;
  }else if(level < 5){
    divisor = 2;
  }else if(level < 8){
    divisor = 3;
  }else{
    divisor = 5;
  }
  var nextValue = calculateNextPortfolioValue(level) / divisor;
  nextValue += nextValue * cash_on_hand_bonus_limit;
  //now we factor in the bonus percentage
  return nextValue;
}

//returns the company_value needed to get to the next level
function calculateNextPortfolioValue(level){
  var nextLevel = level + 1;
  var nextValue = 0;
  var m1 = 1.48825;
  var n1 = .00008638;
  nextValue = Math.pow(Math.E, (nextLevel/m1)) / n1;
  return nextValue;
}

//returns the level based on the portfolio value
function calculateLevel(company_value){
  if(company_value <= 0)return 0;
  var level = 0;
  var m1 = 1.48825;
  var n1 = .00008638;
  level = m1*Math.log(n1*company_value);
  level = Math.floor(level);
  return level;
  
}

/*
  Calculates the value of a city
  Based on it's city_type and
  it's distance from coffee creek
*/
function calculateCityValue(city){
  var coffeeCreek = {
    lat: 41.08749,
    lon: -122.717445
  }
  var cityLoc = {
    lat: city.lat,
    lon: city.longi
  }
  
  var base = 100000;
  var city_amt = getCityAmt(city.city_type);
  var distance = Distance.between(cityLoc, coffeeCreek);
  var distance_multiplier = distanceFunction(distance);
  var value = base * city_amt;
  value = value * distance_multiplier;

  //multiply by a random value that was generated in the database
  //the value is between -1 and 1
  //anything that is negative gets multiplied by -10  
  //the final thing is multiplied by value
  var rand_from_db = city.rand;
  var multiplier = 1;
  if(rand_from_db < 0){
    multiplier = rand_from_db * -100;
  }else{
    if(rand_from_db >= .4 && rand_from_db < .5){
      multiplier = 100000;
    }else if(rand_from_db >= .1 && rand_from_db < .3){
      multiplier = rand_from_db * .001;
    }else if(rand_from_db >= .3 && rand_from_db < .4){
      multiplier = rand_from_db * .01;
    }else if(rand_from_db >= .5 && rand_from_db < .8){
      multiplier = rand_from_db * .1;
    }else{
      multiplier = rand_from_db;
    }
  }

  if(multipier = 0) multiplier = 1;
  value = value * multiplier;;


  return value;
}

//returns a multiplier based on city_type
function getCityAmt(city_type){
  var returnVal = 0;
  switch(city_type){
    case "Other":
      returnVal = 1;
    break;
    case "Provincial capital":
      //returnVal = 50;
      returnVal = 500;
    break;
    case "Provincial capital enclave":
     // returnVal = 175;
      returnVal = 2500;
    break;
    case "National and provincial capital":
      //returnVal = 250;
      returnVal = 10000;
    break;
    case "National capital":
      //returnVal = 500;
      returnVal = 50000;
    break;
    case "National capital and provincial capital enclave":
      //returnVal = 1000;
      returnVal = 1000000;
    break;
  }
  return returnVal;
}

function distanceFunction(distance){
  var returnVal;
  //returnVal = -0.8 * Math.log(distance * 100000) + 20;
  //returnVal = 100 / (.004 * (distance + 300));
  //returnVal = (-.001 * (distance*6372.8)) + 50;
  returnVal = (-1/220) * (distance * 6372.8) + 50;
  //console.log("distance: " + (distance*6372.8) + "  multiplier: " + returnVal);
  return returnVal;
}

function doesUserOwnCity(user, city){
  var returnVal = false;
  for(var i = 0; i < user.property.owned.length; i++){
    if(user.property.owned[i].property_id == city._id){
      returnVal = true;
      break;
    }
  }
  //console.log("user.property.owned: " + user.property.owned );
  //console.log("does user own city: " + returnVal);
  return returnVal;
}

/*simulates a timestep in the game
  goes through every players property and generates cash
  based on what the player ownes
*/
function timeStep(numSteps, currentStep = 0){
  ticks++;
  console.log("timeStep("+numSteps+", "+currentStep+"): " + ticks);
  //loop through all users
  //sub loop through users owned propertys
  //find matches to cities
  //calculate how much the player owns, how much that is worth
  //use calculations in viewProperty to calculate new cash
  //update new cash, and how much each property has made, and 
  //update user.income.last_day
  Users.find({ },{},).exec(function(err, allusers){
    if(err)throw err;
    //get a list of each property id any user has access to
    var all_properties_owned_ids = [];
    for(var i = 0; i < allusers.length; i++){
      //loop through each users user.property.owned
      for(var j = 0; j < allusers[i].property.owned.length; j++){
        all_properties_owned_ids.push(allusers[i].property.owned[j].property_id);
      }
    }
    //now all_properties_owned_ids has the id of every property a user owns
    //lets query the database for all cities with those id's
      var obj_ids = all_properties_owned_ids.map(function(id) { return ObjectId(id); });
      Cities.find({_id: {$in: obj_ids}},{},).exec(function(err, allcities){
        //allcities now has every city that is owned
        //loop through each user.property.owned, find it's property_id
        //get the cooresponding info from allcities
        for(i = 0; i < allusers.length; i++){
          for(var j = 0; j < allusers[i].property.owned.length; j++){
            //now loop through all cities and find the cooresponding id
            for(var k = 0; k < allcities.length; k++){
              if(allusers[i].property.owned[j].property_id == allcities[k]._id){
                //we've found a match
                var city_value = calculateCityValue(allcities[k]);
                var city_value_per_share = city_value / 100;
                var shares_owned = allusers[i].property.owned[j].percent_owned;
                var value_city_owned = shares_owned * city_value_per_share;
                //console.log("user: " + allusers[i].company_name + " owns " + value_city_owned + " of " + allcities[k].city_name);

                //now we update cash earned and user.income.last_day, and property.owned cash earnedi
                var daily_income = value_city_owned * .1001;
                var daily_cost   = value_city_owned * .1;
                var daily_profit = daily_income - daily_cost;
                var cash_earned = daily_profit;
                
                  //this is where the money earned is changed, we need to check
                  //to make sure our cash on hand isn't going to go over the limit.
                  var level = allusers[i].level;
                  var cashOnHand = allusers[i].cash_on_hand;
                  var cashLimit = calculateCashOnHandLimit(level, allusers[i].cash_on_hand_bonus_limit);
                  if((cashOnHand + cash_earned) <= cashLimit ){
                    allusers[i].property.owned[j].total_earned += cash_earned;
                    allusers[i].cash_on_hand += cash_earned;
                  }else{
                    var diff = cashLimit - cashOnHand;
                    if(diff > 0){
                      //console.log("Adding limited cash: " + diff);
                      allusers[i].property.owned[j].total_earned += diff;
                      allusers[i].cash_on_hand += diff;
                    }
                  }
                  
                  if(ticks % 10080 == 0){//a month has passed
                    //console.log("month to year: " + allusers[i].income.last_month);
                    allusers[i].income.last_year += allusers[i].income.last_month;
                    allusers[i].income.last_month = 0;
                  }
                  
                  if(ticks % 1440 == 0){//a week has passed
                    //console.log("week to month: " + allusers[i].income.last_week);
                    allusers[i].income.last_month += allusers[i].income.last_week;
                    allusers[i].income.last_week = 0;
                  }
                 
                   //keep income record
                  if(ticks % 60 == 0){ //a day has passed
                    //console.log("day to week: " + allusers[i].income.last_day);
                    allusers[i].income.last_week += allusers[i].income.last_day;
                    allusers[i].income.last_day = 0;
                  }

                  allusers[i].income.last_day += cash_earned;
                  break;
              }
            }
            allusers[i].save();
          }
        }
        /*
        if(currentStep >= numSteps){
          console.log("saving users");
          for(var i = 0; i < allusers.length; i++){
            allusers[i].save();
          }
        }else{
          timeStep(numSteps, currentStep + 1);
        }
        */
  
      });
  });
}
















