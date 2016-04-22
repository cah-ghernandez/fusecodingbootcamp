/* 
    Author: Gio Hernandez
    Description: Gets a Marvel Superhero name and grabs the description from Marvel using Marvel APIs.
*/


// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {

        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.846681cc-a33a-425f-8a7e-eb7918b431b6") {
             context.fail("Invalid Application ID");
        }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                },context);
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId + ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId + ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback, context) {
    console.log("onIntent requestId=" + intentRequest.requestId + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if ("WhoIsThisSuperhero" === intentName) {
        getSuperhero(intent, session, callback, context);
    } else if ("AMAZON.HelpIntent" === intentName) {
        getWelcomeResponse(callback);
    } else if ("AMAZON.StopIntent" === intentName || "AMAZON.CancelIntent" === intentName) {
        handleSessionEndRequest(callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId + ", sessionId=" + session.sessionId);
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Hello, my name is JARVIS. I am an AI built by Tony Stark with expertise on the Marvel Universe. " +
                       "Which Marvel Superhero would you like to know about?";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    var repromptText = "Which Marvel Superhero would you like to know about?";
    var shouldEndSession = false;

    callback(sessionAttributes,buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    var cardTitle = "Session Ended";
    var speechOutput = "I will power off for now to recharge!";
    // Setting this to true ends the session and exits the skill.
    var shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function getSuperhero(intent, session, callback, context) {
    var cardTitle = intent.name;
    var repromptText = "";
    var sessionAttributes = {};
    var shouldEndSession = false;
    var speechOutput = "";
    var http = require( 'http' );

    if (intent.slots.heroname) {
        var heroname = intent.slots.heroname.value;
        var apikey = "e992ac3e89d0d8597249d43fcb22a929";
        var url = "http://gateway.marvel.com:80/v1/public/characters?name=" + heroname + 
                  "&ts=20160419251&apikey=" + apikey + "&hash=b4e3e427ca023a9993c84dfa40f3ad09";
        http.get( url, function( response ) {
            var data = '';
            var description = '';
            
            console.log("Got response: " + response.statusCode);
            
            response.on( 'data', function( x ) { data += x; } );

            response.on( 'end', function() {

                var json = JSON.parse(data);
                
                if (json.data.results.length > 0){
                  
                    var description = json.data.results[0].description;
                    
                    saveSuperheroData(json.data.results[0],callback);
                    
                    if (description === ""){
                        speechOutput = heroname + ", does not have a description.";
                    }else{
                        speechOutput = heroname + ", " + description;
                    }
                    repromptText = "";  
                } else{
                    speechOutput = "I couldn't find any hero under that name.";
                    repromptText = "";   
                }       
                    
                callback(sessionAttributes,buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
            } );
        }).on('error', function (e) {
                console.log("Got error: " + e.message);  
                speechOutput = "I'm having trouble with your request.";
                repromptText = "You can ask me who any Marvel Hero is, for example; Who is Iron Man?";        
                callback(sessionAttributes,buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
            } );
    } else {
        console.log("Invalid Hero Name: " + intent.slots.heroname);
        speechOutput = "I'm having trouble with your request.";
        repromptText = "You can ask me who any Marvel Hero is, for example; Who is Iron Man?";        
        callback(sessionAttributes,buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    }
}

function saveSuperheroData(superheroData,callback){
    
    var AWS = require("aws-sdk");
    var doc = require('dynamodb-doc');
    var dynamodb = new doc.DynamoDB();
    var params = {
    Item: {
        //heroId: {N: superheroData.id},
        //Data: {S: JSON.stringify(superheroData)}
        heroId: {N: 123},
        data: {S: "Test"}
    },
    TableName: 'JarvisSkillHeroData'
    };
            
    dynamodb.putItem(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
    });
    /*dynamodb.putItem(json, function(error, results) {
        if (err) {
            console.log('ERROR: Dynamo failed: ' + error + " " + results);
        } else {
            console.log('Dynamo Success: ' + JSON.stringify(data, null, '  '));
        }
    }); */
}
// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}