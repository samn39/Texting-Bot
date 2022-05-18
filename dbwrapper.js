/**
 * DB Wrapper.js
 * 
 * This file provides functions for interacting with the database
 */

 const fs = require('fs');
 const path = require('path');
 
 const DEFAULTS_PATH = path
	 .join(__dirname, 'db', 'defaults');
 
 const DEFAULT_FILES = fs
	 .readdirSync(DEFAULTS_PATH)
	 .map(elm => elm.substring(0, elm.length-5));
 
 console.log(DEFAULT_FILES);
 
 const DBWrapper = {
	getAllUsers: () => {
		return fs
			.readdirSync(path.join(__dirname, 'db'))
			.filter(foldname => {return foldname !== "defaults"});
	},

	 // Returns T / F if a user exists
	 userExists: (user_number) => {
		 const uid = String(user_number);
		 return fs
			 .readdirSync(path.join(__dirname, 'db'))
			 .filter(foldname => { return foldname === uid; })
			 .length > 0;
	 },
 
	 addUser: (user_number) => {
		 user_number = String(user_number);
 
		 // Check if they exist
		 if (DBWrapper.userExists(user_number)) {
			 console.warn(`Attempted to add user ${user_number} but they already exist`);
			 return;
		 }
 
		 // Create folder
		 const uid = String(user_number);
		 const folderpath = path.join(__dirname, 'db', uid);
		 fs.mkdirSync(folderpath);
 
		 // Copy defaults
		 const defaultfiles = fs.readdirSync(DEFAULTS_PATH);
		 console.log(defaultfiles);
		 defaultfiles.forEach(file => {
			 const defaultsource = path.join(__dirname, 'db', 'defaults', file)
			 const newuserdest = path.join(__dirname, 'db', uid, file);
			 fs.copyFileSync(defaultsource, newuserdest);
		 });
	 },
 
	 getData: (user_number, table) => {
		 user_number = String(user_number);
 
		 if (!DEFAULT_FILES.includes(table)) {
			 console.error(`Attempting to access un-registered table ${table}. Create a default .json in /db/defaults`);
			 return {};
		 }
 
		 if (!DBWrapper.userExists(user_number)) {
			 console.log(`Getting data for user ${user_number} who doesn't exist. Creating default files`);
			 DBWrapper.addUser(user_number);
		 }
 
		 return JSON.parse(fs.readFileSync(path.join(__dirname, 'db', user_number, table + '.json')));
	 },
 
	 setData: (user_number, table, new_json) => {
		 user_number = String(user_number);
 
		 if (!DEFAULT_FILES.includes(table)) {
			 console.error(`Attempting to access un-registered table ${table}. Create a default .json in /db/defaults`);
			 return;
		 }
 
		 if (!DBWrapper.userExists(user_number)) {
			 console.log(`Setting data for user ${user_number} who doesn't exist. Creating default files`);
			 DBWrapper.addUser(user_number);
		 }

		 if (table === "state") {
			 console.log(`> ${new_json.phase}, ${new_json.mode}`)
			 if (!new_json.mode) {
				 throw error;
			 }
		 }
 
		 fs.writeFileSync(path.join(__dirname, 'db', user_number, table + ".json"), JSON.stringify(new_json), 'utf-8');
	 }
 };
 
 module.exports = DBWrapper;
 