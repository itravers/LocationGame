// app/models/jQuestions.js
// questions from quiz bowl
// load the things we need
var mongoose = require('mongoose');
var random   = require('mongoose-simple-random');

// define the schema for our user model
var locationSchema = mongoose.Schema({
    id               : String,
    orig_url         : String,   
    title            : String, 
    city_id          : Number,   
    city_name        : String,   
    state            : String,   
    lat              : Number,
    longi            : Number,
    location         : Object,
    foursquare       : Object
},
{
  collection: 'locations'
});

//add random ability to schema
locationSchema.plugin(random);

// create the model for quizQuestions and expose it to our app
module.exports = mongoose.model('locations', locationSchema);


