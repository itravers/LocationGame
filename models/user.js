// app/models/user.js
// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

var historySchema = mongoose.Schema({
  type          : String,
  qid           : mongoose.Schema.Types.ObjectId,
  wrongattempts : Number,
  rightattempts : Number
});

// define the schema for our user model
var userSchema = mongoose.Schema({

    local            : {
        email        : String,
        password     : String,
    },
    facebook         : {
        id           : String,
        token        : String,
        name         : String,
        email        : String,
        photo        : String
    },
    twitter          : {
        id           : String,
        token        : String,
        displayName  : String,
        username     : String,
        photo        : String
    },
    google           : {
        id           : String,
        token        : String,
        email        : String,
        name         : String,
        photo        : String
    },
    income           : {
        last_day     : Number,
        last_week    : Number,
        last_month   : Number,
        last_year    : Number
    },
    company_value    : Number,
    permissions      : Object,
    portfolio_value  : Number,
    cash_on_hand     : Number,
    cash_tied_up     : Number,
    level            : Number,
    groupies         : Number,
    company_name     : String

});

// methods ======================
// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);


