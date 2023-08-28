//jshint esversion:6
require('dotenv').config()
const express =require("express");
const ejs=require("ejs");
const bodyParser=require("body-parser");
const mongoose=require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');



const app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));
app.set("view engine","ejs");

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDB");

const userSchema=new mongoose.Schema({
  userName:String,
  password:String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User=new mongoose.model("User",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { id: user.id, username: user.username, name: user.name });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb) {
  console.log(profile);
  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

app.get("/",function(req,res){
  res.render("home");
});

app.get("/login",function(req,res){
  res.render("login");
});

app.get("/register",function(req,res){
  res.render("register");

});

app.get("/auth/google",
  passport.authenticate('google', { scope: ['profile'] }));

  app.get("/auth/google/secrets", 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/secrets');
  });

app.get("/secrets",function(req,res){
  User.find({
    "secret": {$ne: null}
  }).then(foundUser=>{
    if(foundUser){
      res.render("secrets", {userWithSecrets: foundUser});
    }else{
      res.send("error");
    }
  })
});

app.get("/submit",function(req,res){
  if(req.isAuthenticated()){
    res.render("submit");
  }else{
    res.redirect("/login");
  }
});

app.post("/submit",function(req,res){
  const submittedSecrets = req.body.secret;

  User.findById(req.user.id).then(foundUser=>{
    if(foundUser){{
        foundUser.secret = submittedSecrets;
        foundUser.save();
        res.redirect("/secrets");
    }}else{
        res.send("error");
    }
 }).catch(err=>{
    console.log(err);
 });
});

app.get("/logout",function(req,res,next){
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

app.post("/register",function(req,res){

  User.register({username:req.body.username}, req.body.password, function(err,user){
    if(err){
      console.log(err);
      res.redirect("/register");
    }else{
      passport.authenticate("local")(req,res,function(){
        res.redirect("/secrets");
      });
    }
  });
  
});

app.post("/login",function(req,res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if(err){
      console.log(err);
    }else{
      passport.authenticate("local")(req,res, function(){
        res.redirect("/secrets");
      });
    }
  });

});










app.listen(3000,function(){
  console.log("port created at 3000");
})