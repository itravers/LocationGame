// app/models/jQuestions.js
// questions from quiz bowl
// load the things we need
var mongoose = require('mongoose');
var random   = require('mongoose-simple-random');
var ownersSchema = mongoose.Schema({
  owner_id      : String,
  percent_owned : Number
});

// define the schema for our user model
var citiesSchema = mongoose.Schema({
    _id              : Object,
    city_name        : String,   
    lat              : Number, 
    longi            : Number,   
    location         : Object,   
    country_code     : String,   
    country_name     : String,
    city_type        : String,
    percent_owned    : {type: Number, default: 0},
    owners           : [ownersSchema]
},
{
  collection: 'cities'
});

//add random ability to schema
citiesSchema.plugin(random);

// create the model for quizQuestions and expose it to our app
module.exports = mongoose.model('cities', citiesSchema);


