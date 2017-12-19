$(function(){
  console.log("answerIndex: " + answerIndex);
  console.log("loggedIn: " + loggedIn);
  console.log("answersLength: " + answersLength);
  console.log("questionId: " + questionId);
 
  //if answers.length < 12, refresh page, as an error will happen otherwise
  if(answersLength < 12){
     loadNewQuestion();
  }
});


function loadNewQuestion(){
  window.location.href = "/";
//  alert("loading new question");
}

//The user clicked the "report problems with question" link.
function reportProblemClicked(){
  var problem = $("input[type='radio']:checked").parent().text();

   $.ajax({
        type: "POST",
        url: "/reportproblems",
        data:{
          id: questionId,
          problem: problem,
          questionType: questionType
        },
        success: function(data){
          console.log("success submitting problem: " + data);
        },
        error: function(err){
          console.log("error submitting problem: " + err);
        }
    });

}

//The user clicked an answer button.
function answerClicked(indexClicked){
  //alert("clicked answer: " + indexClicked);
  if(indexClicked == answerIndex){
    $('#'+indexClicked).removeClass("btn-outline-primary");
    $('#'+indexClicked).addClass("btn-success"); 
    //$('#'+indexClicked).attr("disabled", "disabled");
    $('#'+indexClicked).addClass("disabled"); 
    
  
    //disable all buttons
    for(var i = 0; i < 12; i++){
      $('#'+i).attr("disabled", "disabled");
    }
 
    //update score display
    var scoreString = $("#score").text();
    var score = parseFloat(scoreString)+5;
    $("#score").text(score);
   
    //only make an ajax call to server if logged in
    if(loggedIn){ 
      $.get("/rightanswer", function(data, status){
         setTimeout(loadNewQuestion, 500);
     });
    }else{
      setTimeout(loadNewQuestion, 500);
    }
    
    
 
  }else{
    $('#'+indexClicked).removeClass("btn-outline-primary");
    $('#'+indexClicked).addClass("btn-danger");
    //$('#'+indexClicked).attr("disabled", "disabled");
    $('#'+indexClicked).addClass("disabled");
      
    //update score display
    var scoreString = $("#score").text();
    var score = parseFloat(scoreString)-1;
    $("#score").text(score);

    //only make call to server if logged in
    if(loggedIn){
      $.get("/wronganswer", function(data, status){
      });
    }
  }

}
