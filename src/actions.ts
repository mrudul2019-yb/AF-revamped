import * as vscode from 'vscode';
// import { storeTime } from './storeHandler';
// import { GitHandler } from './gitHandler';
// import { DockerHandler } from './dockerHandler';

// const path = require("path");
// const nconf = require('nconf')
// const os = require('os');

// let Git: GitHandler;
// let Docker: DockerHandler;
// let folderPath: string;
// let startTime:number;
// let latestTime:number;
// let timerID:null|NodeJS.Timeout = null;
// let saveProgresstimerID:null|NodeJS.Timeout = null;
// let forcedSaveTimerID:null|NodeJS.Timeout = null;

// let isInitialized: boolean = false;
// let fileChangeListenerDisposable: vscode.Disposable|null = null;
// let fileSaveListenerDisposable: vscode.Disposable|null = null;
// // export { folderPath }

// export function initialize(){
// 	if(isInitialized){
// 		vscode.window.showInformationMessage('Already Initialized');
// 		return;
// 	}
// 	if(vscode.workspace.workspaceFolders !== undefined) {

// 		folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
// 		Git = new GitHandler(folderPath);
// 		nconf.use('file', { file: path.join(folderPath, 'Data', 'metadata.json') });
// 		nconf.load();
// 		Docker = new DockerHandler(folderPath, nconf.get("container_name"));

// 		vscode.window.withProgress({
// 			cancellable: false,
// 			location: vscode.ProgressLocation.Notification,
// 			title: "Starting Container"
// 		},	async (progress) => {
// 			try{
// 				let response = await Docker.exec('start');
// 				const fswatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folderPath, '*.cpp')); 	
// 				fileChangeListenerDisposable = fswatcher.onDidChange(onFileChangeHandler);
// 				fileSaveListenerDisposable = vscode.workspace.onDidSaveTextDocument(onSaveHandler);
// 				intervalForceSave();
// 				isInitialized = true;
// 				vscode.window.showInformationMessage(`${response.message} (${response.time} sec)`);
// 			}
// 			catch(err){
// 				// @ts-ignore
// 				vscode.window.showErrorMessage(`${err.message}`);
// 			}
			
// 		});
// 	}
// 	else{
// 		vscode.window.showErrorMessage('intialize: workspacefoleder is underfined.');
// 		return;
// 	}

	
// }



// export function submitProgress(){
// 	if(!isInitialized){
// 		vscode.window.showErrorMessage(`Initialize first to submit`);
// 		return;
// 	}
// 	vscode.window.withProgress({
// 		cancellable: false,
// 		location: vscode.ProgressLocation.Notification,
// 		title: "Submitting Progress..."
// 	},	async (progress) => {
// 		try{
// 			await Git.submitProgress();
// 			vscode.window.showInformationMessage(`Git: Pushed Successfully!`);
// 		}
// 		catch(err){
// 			// @ts-ignore
// 			vscode.window.showErrorMessage(`Git: ${err.message}`);
// 		}
		
// 	});
// }

// export function run(explicit: boolean, Git: GitHandler, Docker: DockerHandler){
// 	// if(!isInitialized){
// 	// 	vscode.window.showErrorMessage(`Initialize first to run`);
// 	// 	return;
// 	// }
	
// 	let notifLoc = explicit? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window;
	
// 	vscode.window.withProgress({
// 		cancellable: false,
// 		location: notifLoc,
// 		title: "Compiling and Running "
// 	},	async (progress) => {
// 		try{
// 			progress.report({message: "running in docker"});
// 			let response = await Docker.exec('run');
// 			progress.report({message: "Saving Progress"});
// 			await Git.saveProgress();
// 			if(explicit)vscode.window.showInformationMessage(`${response.message} (${response.time} sec)`);
// 		}
// 		catch(err){
// 			// @ts-ignore
// 			vscode.window.showErrorMessage(err.message);
// 		}
		
// 	});
// // }

// export function onSaveHandler(e: vscode.TextDocument){
// 		console.log('onSaveHandler: save triggered event');
// 		// Giving cooldown of 10 seconds between auto commits on save
// 		// To prevent high amount of commits
// 		if(saveProgresstimerID === null){
// 			run(false);
// 			saveProgresstimerID = setTimeout(()=>{
// 				saveProgresstimerID = null;
// 			}, 10*1000);
// 		}
// }

// export function onFileChangeHandler(){
// 	console.log('onFileChangeHandler: smth changed??\n');
// 	let timerInterval:number = <number> vscode.workspace.getConfiguration().get('Timer Shutdown Interval')
// 	if(timerID === null){
// 		startTime = Date.now();
// 		latestTime = Date.now();
// 		timerID = setTimeout(() => {storeTime(folderPath, latestTime - startTime); timerID = null;}, timerInterval*60*1000);
// 	}
// 	else{
// 		clearTimeout(timerID);
// 		latestTime = Date.now();
// 		timerID = setTimeout(() => {storeTime(folderPath, latestTime - startTime); timerID = null;}, timerInterval*60*1000);
// 		storeTime(folderPath, latestTime - startTime);
// 		startTime = latestTime;
// 	}
// }

// export function intervalForceSave(){
// 	// Save all files in specified time intervals
// 	// This will trigger auto commit on save automatically
// 	let forcedSaveInterval:number = <number> vscode.workspace.getConfiguration().get('Force Save Interval');
// 	forcedSaveTimerID = setTimeout(() => {
// 		vscode.workspace.saveAll(false);
// 		intervalForceSave();
// 	}, forcedSaveInterval*60*1000);
// }

// export function shutDown(){
// 	if(!isInitialized){
// 		vscode.window.showErrorMessage(`Initialize first to shut down`);
// 		return;
// 	}
// 	vscode.window.withProgress({
// 		cancellable: false,
// 		location: vscode.ProgressLocation.Notification,
// 		title: "Shuting Down...."
// 	},	async (progress) => {
// 		try{
// 			let response = await Docker.exec('shut down');
// 			freeSpace();
// 			isInitialized = false;
// 			vscode.window.showInformationMessage(`${response.message} (${response.time} sec)`);
// 		}
// 		catch(err){
// 			// @ts-ignore
// 			vscode.window.showErrorMessage(`${err.message}`);
// 		}
		
// 	});
// }
// export function freeSpace(){
// 	if(forcedSaveTimerID !== null)clearTimeout(forcedSaveTimerID);
// 	if(fileChangeListenerDisposable !== null)fileChangeListenerDisposable.dispose();
// 	if(fileSaveListenerDisposable !== null)fileSaveListenerDisposable.dispose();
// }

// export function helloWorld(){
// 	if(vscode.workspace.workspaceFolders !== undefined) {
// 		let wf = vscode.workspace.workspaceFolders[0].uri.path ;
// 		let f = vscode.workspace.workspaceFolders[0].uri.fsPath ; 
		

		
// 		let message = `Hello World from AssignmentFetcher! Location is : ${wf} - ${f}` ;
// 		vscode.window.showInformationMessage(message);

// 	} 
// 	else {
// 		let message = "AssignmentFetcher: Working folder not found, open a folder and try again" ;
		
// 		vscode.window.showErrorMessage(message);
// 	}
// } 