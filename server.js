/**
 * Server.js
 *
 * Entry point for our server
 */

// TODO: Create some kind of graph based system ?

require('dotenv').config();
const express = require('express');
const schedule = require('node-schedule');
const cors = require('cors');
const logger = require('morgan');
const bodyParsers = require('body-parser');
var MessagingResponse = require('twilio').twiml.MessagingResponse;

const phrase = require('./strings');
const healthActions = require('./actions');
const texter = require('./texter');
const db = require('./dbwrapper');
const { text } = require('body-parser');

const router = express.Router();

const PORT = process.env.PORT || 5000;
const app = express();
var number;

app.use(logger('dev'));
app.use(cors());
app.use(bodyParsers.urlencoded({ extended: true }));
app.use(bodyParsers.json());

app.get('/', (req, res) => res.send("Hello!"));

app.get('/test', (req, res) => {
    console.log(db.getAllUsers());
});

app.listen(PORT, () => console.log(`Now listening on port ${PORT} :)`));
var reqData;
var wantSubscribe;



const txtMode = {
    default: 'default',
    profile_setup: 'profile_setup',
    profile: 'profile',
    day_rating: 'day_rating',
    unsubscribed: 'unsubscribed',
    rant: 'rant',
    rant_history: 'rant-history',
    tic_tac_toe: 'tic-tac-toe',
}

const EXIT_STR = [
    "finish", "finished", "done"
]

const YES_STR = [
    "yes", "y", "ye", "yea", "yeah"
]

const NO_STR = [
    "no", "n", "na", "nah"
]

function is_in_list (word, list) {
    return list.some(wrd => wrd === word.trim().toLowerCase());
}

/**
 * Returns whether the message contains a word in the list.
 * Ex:
 * message: "The brown fox jumped"
 * list: ["brown", "black", "green"]
 * 
 * returns true
 */
function has_word_in_list (message, list) {
    return list.some(
        word => message.trim().toLowerCase().includes(
            word.trim().toLowerCase()
    ));
}


/**
 * Parses the string passed into an integer. If it is
 * out of the bounds or invalid, will return -1. -1
 * should as thus not be a valid option.
 * Min and max are inclusive acceptable values.
 */
function parse_number_input (str, min, max) {
    var number_choice = -1;

    try {
        number_choice = parseInt(str.trim());
    } catch (err) {
        return -1;
    }

    if (number_choice < min || number_choice > max) {
        return -1;
    } else {
        return number_choice;
    }
}






app.post('/message', (req, res) => {
    const tempBody = req.body;
    const reqData = tempBody.Body;
    const number = tempBody.From;
    
    var mode = db.getData(number, 'state').mode;
    var phase = db.getData(number, 'state').phase;

    console.log(`New text from ${number}. Mode ${mode}, phase ${phase}`);

    switch (mode) {
        case txtMode.default:
            switch_to_mode(reqData, res, number);
            break;

        case txtMode.unsubscribed:
            mode_unsubbed(reqData, res, number);
            break;

        
        // Actual Health stuff
        case txtMode.profile:
            mode_profile(reqData, res, number);
            break;
        
        case txtMode.profile_setup:
            mode_profile_setup(reqData, res, number);
            break;


        // TODO
        case txtMode.day_rating:
            mode_dayrate(reqData, res, number);
            break;


        // Ranting applet
        case txtMode.rant:
            mode_rant(reqData, res, number);
            break;
        
        case txtMode.rant_history:
            mode_rant_history(reqData, res, number);
            break;


        // Needs testing but I don't think it's worth touching right now
        case txtMode.tic_tac_toe:
            mode_tictactoe(reqData, res, number);
            break;
    }
});


function switch_to_mode(reqData, res, number) {
    var state_data = db.getData(number, 'state');
    
    var phase = state_data.phase;

    switch (phase) {
        // Show options table
        case 0:
            texter.sendMsg(number, phrase.default_list());
            state_data.phase += 1;
            break;
            

        // Read their answer
        case 1:
            const index_choice = parse_number_input(reqData, 1, 5);
            console.log(`Input data: ${index_choice}`);

            if (index_choice === -1) {
                texter.sendMsg(number, phrase.invalid_choice());
                return;
            }

            switch (index_choice) {
                case 1: // view profile
                    const name = db.getData(number, 'profile').name;
                    const goalNum = db.getData(number, 'profile').goal;
                    const goal = healthActions.goals[goalNum];
                    const specifics = db.getData(number, 'profile').specifics;
                    texter.sendMsg(number, phrase.profile_display(name, goal, specifics));
                    state_data.phase = 0;
                    break;

                case 2: // update profile
                    texter.sendMsg(number, phrase.profile_name());
                    state_data.phase = 3;
                    state_data.mode = txtMode.profile_setup;
                    break;
                
                case 3: // tic tac toe
                    state_data.phase = 0;
                    state_data.mode = txtMode.tic_tac_toe;
                    db.setData(number, 'state', state_data);
                    mode_tictactoe(reqData, res, number);
                    break;
                
                case 4: // Notes
                    state_data.phase = 0;
                    db.setData(number, 'state', state_data);
                    mode_rant();
                    break;
                
                case 5: // View Daily Goal
                    state_data.phase = 0;
                    const action_num = db.getData(number, 'profile').goal;
                    if (action_num === -1) {
                        texter.sendMsg(number, "You need to setup your profile before I can give you goals!");
                    } else {
                        const possible_dailies = healthActions.actions[action_num];
                        const random_ind = Math.floor(Math.random() * possible_dailies.length);
                        texter.sendMsg(number, `Your goal for today is "${possible_dailies[random_ind]}".`);
                    }
                    
                    break;

            }
            break;
    }

    db.setData(number, 'state', state_data);
}


function mode_unsubbed(reqData, res, number) {
    state_data = db.getData(number, "state");

    const phase = state_data.phase;

    switch (phase) {
        // This means they responded after being 'unsubbed'
        // we prompt them to ask if they do want to opt in
        case 0:
            texter.sendMsg(number, phrase.unsub_return());
            state_data.phase = 1;
            state_data.mode = txtMode.profile_setup;
            break;
    }

    db.setData(number, "state", state_data);
}


function mode_profile_setup(reqData, res, number) {
    let state_data = db.getData(number, 'state');
    let profile_data = db.getData(number, 'profile');

    const phase = state_data.phase;

    let agreed, rejected, specifics;

    console.log(`Inside profile setup function. Phase ${phase} and mode ${state_data.mode}`);

    switch (phase) {
        // First message, a confirmation you want messages
        case 0:
            texter.sendMsg(number, phrase.new_explanation());
            state_data.mode = txtMode.profile_setup;
            state_data.phase += 1;
            break;
        
        // Second message
        // Respond to confirmation & prompt about profile setup
        case 1:
            agreed = is_in_list(reqData, YES_STR);
            rejected = is_in_list(reqData, NO_STR);

            if (!agreed && !rejected) {
                texter.sendMsg(number, phrase.unable_to_understand);
                return;
            }

            if (agreed) {
                texter.sendMsg(number, phrase.profile_firstprompt())
                state_data.phase += 1;
            } else {
                texter.sendMsg(number, phrase.new_notsubbed());
                state_data.phase=0;
                state_data.mode=txtMode.unsubscribed;
            }
            break;
        
        // Third message
        // Figure out do they want to setup their profile rn
        case 2: // <=== This is where to jump to if I want to setup from the menu
            agreed = is_in_list(reqData, YES_STR);
            rejected = is_in_list(reqData, NO_STR);

            if (!agreed && !rejected) {
                texter.sendMsg(number, phrase.unable_to_understand());
                return;
            }

            if (agreed) {
                texter.sendMsg(number, phrase.profile_name());
                state_data.phase += 1;

            } else {
                texter.sendMsg(number, phrase.profile_reject_first());
                state_data.phase = 0;
                state_data.mode = txtMode.default;
            }
            break;

        // Fourth message
        // Read in their name and ask about goals
        case 3:
            const name = reqData.trim();

            if (name.length === 0) {
                texter.sendMsg(number, phrase.unable_to_understand());
                return;
            }

            texter.sendMsg(number, phrase.profile_list_goals(healthActions.goals));

            profile_data.name = name;
            state_data.phase += 1;
            break;
        
        // Fifth message
        // Read in their goals and ask about specifications
        case 4:
            const max_ind = healthActions.goals.length;
            const number_choice = parse_number_input(reqData, 1, max_ind) - 1;

            if (number_choice == -2) {
                texter.sendMsg(number, phrase.unable_to_understand());
                return;
            }

            specifics = healthActions['focus-prompts'][number_choice];
            texter.sendMsg(number, phrase.profile_specifics_prompt(specifics));

            profile_data.goal = number_choice;
            state_data.phase += 1;
            break;
        
        // Sixth message
        // Read in their specifics and confirm all info
        case 5:
            specifics = reqData.trim().toLowerCase().split(",");
            specifics = specifics.map(elm => elm.trim());
            specifics = specifics.filter(elm => elm !== "");
            profile_data.specifics = specifics;

            console.log(`Specifics: ${specifics}`);
            const locName = profile_data.name;
            const locGoal = profile_data.goal;
            texter.sendMsg(number, phrase.profile_confirmation(locName, locGoal, specifics));

            state_data.phase += 1;
            break;
        
        case 6:
            console.log("In case 6")
            agreed = is_in_list(reqData, YES_STR);
            rejected = is_in_list(reqData, NO_STR);

            if (!agreed && !rejected) {
                texter.sendMsg(number, phrase.unable_to_understand());
                return;
            }

            console.log(`Agreed: ${agreed}, `);

            if (agreed) {
                // if ok
                texter.sendMsg(number, phrase.profile_everything_correct());
                state_data.phase = 0;
                state_data.mode = txtMode.default;
            } else {
                // Loop back around here
                texter.sendMsg(number, phrase.profile_name());
                state_data.phase = 3;
                state_data.mode = txtMode.profile_setup;
            }
            break;

    }


    db.setData(number, "state", state_data);
    db.setData(number, "profile", profile_data);
}


function mode_profile(reqData, res, number) {
    console.log("mode_profile called but it's not setup yet");
}


// TODO
function mode_dayrate(reqData, res, number){
}



function mode_rant(reqData, res, number) {
    state_data = db.getData(number,"state");
    rant_data = db.getData(number, "rant");

    const phase = state_data.phase;

    switch (phase) {
        case 0:
            texter.sendMsg(number, phrase.rant_choose());
            state_data.phase += 1;
            state_data.mode = txtMode.rant;
            break;

        case 1:
            START_WORDS = ['start', 'new', 'create', 'make'];
            VIEW_WORDS = ['history', 'view', 'older', 'look'];

            if (has_word_in_list(reqData, VIEW_WORDS)) {
                // Transition to rant history
                const rant_names = [];
                rant_data.forEach(elm => rant_names.push(elm.name));

                texter.sendMsg(number, phrase.rant_going_to_history(rant_names));

                state_data.mode = txtMode.rant_history;
                state_data.phase = 0;

            } else if (has_word_in_list(reqData, START_WORDS)) {
                texter.sendMsg(number, phrase.rant_startup());
                state_data.phase += 1;

            } else {
                texter.sendMsg(number, phrase.unable_to_understand());
            }
            break;

        case 2:
            const rantName = reqData.trim();
            const emptyRant = {
                "name": rantName,
                "messages": []
            };
            rant_data = [emptyRant].concat(rant_data);

            texter.sendMsg(number, phrase.rant_ready(rantName));
            
            state_data.phase += 1;
            break;

        case 3:
            if (is_in_list(reqData, EXIT_STR)){
                const rant_name = rant_data[0].name;
                texter.sendMsg(number, phrase.rant_finished(rant_name));

                state_data.phase = 0;
                state_data.mode = txtMode.default;
            } else {
                const msg_list = rant_data[0].messages;
                rant_data[0].messages = msg_list.concat([reqData.trim()]);
            }
            break;
    }

    db.setData(number, "rant", rant_data);
    db.setData(number, "state", state_data);
}


function mode_rant_history (reqData, res, number) {
    state_data = db.getData(number, "state");
    rant_data = db.getData(number, "rant");

    // This only ever gets executed once before changing mode,
    // hence the lack of a switch statement

    const index_choice = parse_number_input(1, rant_data.length);

    if (index_choice === -1) {
        texter.sendMsg(number, phrase.invalid_choice());
        return;
    }

    index_choice--;

    console.log("Checking if rant is printable");

    if (!rant_data[index_choice] ||
        !rant_data[index_choice].messages || 
        rant_data[index_choice].messages.length == 0) {
            console.log("Found empty rant");
            texter.sendMsg(number, phrase.rant_history_empty());

    } else {
        console.log("Rant has content");
        const rant_name = rant_data[index_choice].name;
        const rant_msgs = rant_data[index_choice].messages;

        texter.sendMsg(number, phrase.rant_history_sending(rant_name));
        rant_msgs.forEach(msg => texter.sendMsg(number, msg));
    }

    state_data.mode = txtMode.default;
    state_data.phase = 0;
    db.setData(number, "state", state_data);
}


function mode_tictactoe (reqData, res, number) {
    state_data = db.getData(number, "state");
    tictactoe_data = db.getData(number, "tictactoe");

    const phase = state_data.phase;

    switch(phase) {
        // Starting the game of tictactoe.
        // Ask the user whether they want to go first
        case 0:
            texter.sendMsg(number, phrase.tictactoe_moveorder());

            state_data.mode = txtMode.tic_tac_toe;
            state_data.phase += 1;
            break;
        
        // The user responded to whether they go first.
        // Now we setup the board, and then start playing.
        case 1:
            const userGoesFirst = is_in_list(reqData, YES_STR);
            const compGoesFirst = is_in_list(reqData, NO_STR);

            if (!userGoesFirst && !compGoesFirst) {
                texter.sendMsg(number, phrase.unable_to_understand());
                return;
            }

            tictactoe_data = {
                "user_move": userGoesFirst,
                "board": [
                    " ", " ", " ", 
                    " ", " ", " ",
                    " ", " ", " "
                ]
            };
            texter.sendMsg(number, phrase.tictactoe_beginning());
            state_data.phase += 1;

            if (userGoesFirst) {
                texter.sendMsg(number, phrase.tictactoe_userstart());
            } else {
                const computerMove = tictactoe_selectmove(tictactoe_data.board);
                tictactoe_data.board[computerMove] = "O";
                texter.sendMsg(numer, phrase.tictactoe_board(tictactoe_data.board));
                texter.sendMsg(number, phrase.tictactoe_usermove());
            }

            db.setData(number, "tictactoe", tictactoe_data);
            db.setData(number, "state", state_data);

            break;

        // Actual game logic
        // The user is always X, while the computer is O
        // Algorithm used is just randomness
        case 2:
            // Read user move
            const number_choice = parse_number_input(reqData, 1, 9) - 1;
            if (number_choice === -2 || tictactoe_data.board[number_choice] !== " ") {
                texter.sendMsg(number, phrase.invalid_choice());
                return;
            }
            tictactoe_data.board[number_choice] = "X";

            let gamestate = tictactoe_winstatus(tictactoe_data.board);

            if (gamestate === "") {
                const computerMove = tictactoe_selectmove(tictactoe_data.board);
                tictactoe_data.board[computerMove] = "O";
                gamestate = tictactoe_winstatus(tictactoe_data.board);
            }

            texter.sendMsg(number, phrase.tictactoe_board(tictactoe_data.board));

            switch (gamestate) {
                case "":
                    break;

                case "tie":
                    texter.sendMsg(number, phrase.tictactoe_tie());
                    break
                
                case "user":
                    texter.sendMsg(number, phrase.tictactoe_userwin());
                    break;

                case "computer":
                    texter.sendMsg(number, phrase.tictactoe_compwin());
                    break;
            }

            if (gamestate !== "") {
                state_data.mode = txtMode.default;
                state_data.phase = 0;
            }
            break;
    }

    db.setData(number, "state", state_data);
    db.setData(number, "tictactoe", tictactoe_data);
}


// Returns "", "tie", "user", "computer" depending
// on who won or if the game is still going
function tictactoe_winstatus (board) {
    let sums;
    let chars = ['X', 'O'];

    // Check for winners (ugly but it works lmao)
    const userWin = (
        // Horizontal
        (board[0] === 'X' && board[1] === 'X' && board[2] === 'X') ||
        (board[3] === 'X' && board[4] === 'X' && board[5] === 'X') ||
        (board[6] === 'X' && board[7] === 'X' && board[8] === 'X') ||

        // Vertical
        (board[0] === 'X' && board[3] === 'X' && board[6] === 'X') ||
        (board[1] === 'X' && board[4] === 'X' && board[7] === 'X') ||
        (board[2] === 'X' && board[5] === 'X' && board[8] === 'X') ||

        // Diagonal
        (board[0] === 'X' && board[4] === 'X' && board[8] === 'X') ||
        (board[6] === 'X' && board[4] === 'X' && board[2] === 'X')
    );

    const compWin = (
        // Horizontal
        (board[0] === 'O' && board[1] === 'O' && board[2] === 'O') ||
        (board[3] === 'O' && board[4] === 'O' && board[5] === 'O') ||
        (board[6] === 'O' && board[7] === 'O' && board[8] === 'O') ||

        // Vertical
        (board[0] === 'O' && board[3] === 'O' && board[6] === 'O') ||
        (board[1] === 'O' && board[4] === 'O' && board[7] === 'O') ||
        (board[2] === 'O' && board[5] === 'O' && board[8] === 'O') ||

        // Diagonal
        (board[0] === 'O' && board[4] === 'O' && board[8] === 'O') ||
        (board[6] === 'O' && board[4] === 'O' && board[2] === 'O')
    );

    if (userWin) {
        return "user";
    }
    if (compWin) {
        return "copmuter";
    }
    
    // Check for remaining legal moves
    for (let j=0; j<9; j++) {
        if (board[j] === " ")
            return "";
    }

    // No more moves = tie
    return "tie";
}


function tictactoe_getlegalmoves (board) {
    moves = [];

    board.forEach((elm, index) => {
        if (elm === " ")
            moves.push(index);
    });

    console.log(`Found legal moves for ${board}: ${moves}`);

    return moves;
}


function tictactoe_selectmove (board) {
    const possible_moves = tictactoe_getlegalmoves(board);
    const random_ind = Math.floor(Math.random() * possible_moves.length);
    return possible_moves[random_ind];
}



