import * as vscode from 'vscode';
import { storeTime } from './storeHandler';
import { GitHandler } from './gitHandler';
import { DockerHandler } from './dockerHandler';

const path = require("path");
const nconf = require('nconf')

export class sidePanelProvider implements vscode.WebviewViewProvider {
	// we will make an object when the extension activates only
	// so we can store the state variables inside this itself
	// This object wont be destroyed even if the side bar is destroyed
	// since its not recreated, the html rendering will only be done once(at activation)
	// so injecting contents to getHtml wont work, can do via script only

	public static readonly viewType = 'assignmentfetcher.panelView';
	private _view?: vscode.WebviewView;

	private isLoading: boolean; 
	private isInitialized: boolean; 
	private Git: GitHandler;
	private Docker: DockerHandler;
	private folderPath: string;
	private startTime:number;
	private latestTime:number;
	private timerID:null|NodeJS.Timeout = null;
	private saveProgresstimerID:null|NodeJS.Timeout = null;
	private forcedSaveTimerID:null|NodeJS.Timeout = null;

	private fileSaveListenerDisposable: vscode.Disposable|null = null;
	
	constructor(private readonly _extensionUri: vscode.Uri, folderPath: string){ 
		this.isLoading = false;
		this.isInitialized = false;
		this.startTime = Date.now();
		this.latestTime = Date.now();
		this.folderPath = folderPath;
		this.Git = new GitHandler(this.folderPath);
		nconf.use('file', { file: path.join(this.folderPath, 'Data', 'metadata.json') });
		nconf.load();
		this.Docker = new DockerHandler(this.folderPath, nconf.get("container_name"));
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
		webviewView.webview.options = {
			// Allow scripts in the webview

			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(data => {
			console.log(`frontend to backend ${data.type}`);
			switch (data.type) {
				case 'initialize':{
					this.initialize();
					break;
				}
                case 'submitProgress':{
					this.submitProgress();
					break;
                }
				case 'run':{
					this.run(true);
					break;
                }

				case 'getState':{
                    this.sendState();
					break;
                }
				default: {
                    console.error('Unknown event received from webview');
                }
			}
		});
	}

	private sendState = ()=>{
		this._view?.webview.postMessage({type:'getState', isInitialized: this.isInitialized});
	}

	public initialize = ()=>{
		console.log( "state", this.isInitialized, this.isLoading);
		console.log('backend: initialize');
		if(this.isLoading) return;
		this.isLoading = true;
		// this.isInitialized = !this.isInitialized;
		if(!this.isInitialized){
				vscode.window.withProgress({
					cancellable: false,
					location: vscode.ProgressLocation.Notification,
					title: "Starting Container"
				},	async (progress) => {
					try{
						let response = await this.Docker.exec('start');
						this.fileSaveListenerDisposable = vscode.workspace.onDidSaveTextDocument(this.onSaveHandler);
						
						this.intervalForceSave();
						this.isInitialized = true;
						this.sendState();
						vscode.window.showInformationMessage(`${response.message} (${response.time} sec)`);
						this.isLoading = false;
					}
					catch(err){
						// @ts-ignore
						vscode.window.showErrorMessage(`${err.message}`);
						this.isLoading = false;
					}
					
				});
		}
		else{
			vscode.window.withProgress({
				cancellable: false,
				location: vscode.ProgressLocation.Notification,
				title: "Shuting Down...."
			},	async (progress) => {
				try{
					let response = await this.Docker.exec('shut down');
					this.freeSpace();
					this.isInitialized = false;
					this.sendState();
					vscode.window.showInformationMessage(`${response.message} (${response.time} sec)`);
					this.isLoading = false;
				}
				catch(err){
					// @ts-ignore
					vscode.window.showErrorMessage(`${err.message}`);
					this.isLoading = false;
				}
			});
		}
	}

	public submitProgress = ()=>{
		console.log('backend: submit');
		// if(!this.isInitialized){
		// 	vscode.window.showErrorMessage(`Initialize first to submit`);
		// 	return;
		// }
		vscode.window.withProgress({
			cancellable: false,
			location: vscode.ProgressLocation.Notification,
			title: "Submitting Progress..."
		},	async (progress) => {
			try{
				await this.Git.submitProgress();
				vscode.window.showInformationMessage(`Git: Pushed Successfully!`);
			}
			catch(err){
				// @ts-ignore
				vscode.window.showErrorMessage(`Git: ${err.message}`);
			}
			
		});
	}

	

	public run = (explicit: boolean = true)=>{
		console.log('backend: run');

		// if(!isInitialized){
		// 	vscode.window.showErrorMessage(`Initialize first to run`);
		// 	return;
		// }
		let notifLoc = explicit? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window;
		vscode.window.withProgress({
			cancellable: false,
			location: notifLoc,
			title: "Compiling and Running "
		},	async (progress) => {
			try{
				progress.report({message: "running in docker"});
				let response = await this.Docker.exec('run');
				progress.report({message: "Saving Progress"});
				await this.Git.saveProgress();
				if(explicit)vscode.window.showInformationMessage(`${response.message} (${response.time} sec)`);
			}
			catch(err){
				// @ts-ignore
				vscode.window.showErrorMessage(err.message);
			}
			
		});
	}


    private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>Assignment Fetcher</title>
			</head>
			<body>
				<label class="switch">
					<input id="check" type="checkbox">
					<div></div>
					<span id= "indicator">OFF</span>
				</label>
				<div id ="actions">
					<button id="submitProgress">Submit</button>
					<button id="run">Run</button>
				</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
	private freeSpace = ()=>{
		if(this.forcedSaveTimerID !== null)clearTimeout(this.forcedSaveTimerID);
		// if(this.fileChangeListenerDisposable !== null)this.fileChangeListenerDisposable.dispose();
		if(this.fileSaveListenerDisposable !== null)this.fileSaveListenerDisposable.dispose();
	}
	
	private intervalForceSave = ()=>{
		// Save all files in specified time intervals
		// This will trigger auto commit on save automatically
		let forcedSaveInterval:number = <number> vscode.workspace.getConfiguration().get('Force Save Interval');
		this.forcedSaveTimerID = setTimeout(() => {
			vscode.workspace.saveAll(false);
			this.intervalForceSave();
		}, forcedSaveInterval*60*1000);
	}
	
	//  this listener didnt get called wehn I used in special character heavy path, so combining this with onSave listener for now
	private onFileChangeHandler = ()=>{
		console.log('onFileChangeHandler: smth changed??\n');
		let timerInterval:number = <number> vscode.workspace.getConfiguration().get('Timer Shutdown Interval')
		let storePath: string = path.join(this.folderPath, 'Data', 'studentData.json');

		if(this.timerID === null){
			this.startTime = Date.now();
			this.latestTime = Date.now();
			this.timerID = setTimeout(() => {storeTime(storePath, this.latestTime - this.startTime); this.timerID = null;}, timerInterval*60*1000);
		}
		else{
			clearTimeout(this.timerID);
			this.latestTime = Date.now();
			this.timerID = setTimeout(() => {storeTime(storePath, this.latestTime - this.startTime); this.timerID = null;}, timerInterval*60*1000);
			storeTime(storePath, this.latestTime - this.startTime);
			this.startTime = this.latestTime;
		}
	}
	
	// have to assign function like, name = () =>{}.. else 'this' keyword will not refer
	// to our object but smth else and it will crash
	private onSaveHandler = (e: vscode.TextDocument)=>{
		console.log('onSaveHandler: save triggered event '); 
		// Giving cooldown of 10 seconds between auto commits on save
		// To prevent high amount of commits
		if(this.saveProgresstimerID === null){
			this.run(false);
			this.saveProgresstimerID = setTimeout(()=>{
				this.saveProgresstimerID = null;
			}, 10*1000);
		}
		this.onFileChangeHandler();
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

