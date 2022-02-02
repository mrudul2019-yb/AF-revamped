import * as vscode from 'vscode';
import { storeTime } from './storeHandler';
import { GitHandler } from './gitHandler';
import { DockerHandler } from './dockerHandler';

const path = require("path");
const nconf = require('nconf')

/**
 * Class for implementing side panel. Can be considered as the major part of backend.
 */

export class sidePanelProvider implements vscode.WebviewViewProvider {
	// we will make an object when the extension activates only
	// so we can store the state variables inside this itself
	// This object wont be destroyed even if the side bar is destroyed
	// since its not recreated, the html rendering will only be done once(at activation)
	// so injecting contents to getHtml wont work, can do via script only

	/** View Id as registered in package.json */
	public static readonly viewType = 'assignmentfetcher.panelView';
	private _view?: vscode.WebviewView;

	/** Indicates if container is in the process of setting up or being destroyed.*/
	private isLoading: boolean; 
	/** Indicaters if the container is active.*/
	private isInitialized: boolean; 
	/** Object which handles git related activities.*/
	private Git: GitHandler;
	/** Object which handles docker related activities.*/
	private Docker: DockerHandler;
	/** Path for the folder which was opened using vscode.*/
	private folderPath: string;

	/** Start time of active coding.*/
	private startTime:number;
	/** latest time where active coding happened.*/
	private latestTime:number;

	/** Id of timeout function related to storing active time.*/
	private timerID:null|NodeJS.Timeout = null;

	/** Id of timeout function related to automatic run and commit.*/
	private saveProgresstimerID:null|NodeJS.Timeout = null;
	/** Id of timeout function related to automatic save.*/
	private forcedSaveTimerID:null|NodeJS.Timeout = null;

	/** Disposable related to mounting 'on save' listener for files through vscode api.*/
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

	/**
	 * Sets up webview and listener to recieve message from frontend and act on it.
	 *  
	 */	
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

	/**
	 * Sends the value of {@link sidePanelProvider.isInitialized} to frontend.
	 */
	private sendState = ()=>{
		this._view?.webview.postMessage({type:'getState', isInitialized: this.isInitialized});
	}

	/**
	 * If {@link sidePanelProvider.isLoading} is false, then starts container and binds other listeners if not started else destroys the container and unbinds other listeners.
	 * Acts like a switch and also notifies the user through vscode notification panel at bottom right. 
	 * 
	 */
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

	/**
	 * Pushes the commit and notifies the user.
	 */
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

	
	/**
	 * Runs the code in the container using makefile and notifies silently through bottom bar if not explicit, otherwise notifies through bottom right notification panel.
	 * 
	 * @param explicit Denotes if it was called using `run` button or called as a part of automatic run. True indicates former.
	 */
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

	/**
	 * Makes the html to be rendered in side panel. All the frontend javascript and css is present in the 'media' folder.
	 * 
	 * @param webview 
	 * @returns The html to be rendered in side panel
	 */
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
	/**
	 * Destroys 'on save' listener and removes timed save.
	 */
	private freeSpace = ()=>{
		if(this.forcedSaveTimerID !== null)clearTimeout(this.forcedSaveTimerID);
		// if(this.fileChangeListenerDisposable !== null)this.fileChangeListenerDisposable.dispose();
		if(this.fileSaveListenerDisposable !== null)this.fileSaveListenerDisposable.dispose();
	}
	
	/**
	 * Save all files in intervals specified by 'Force Save Interval' in settings. Saving will trigger auto run and commit on save automatically.
	 */
	private intervalForceSave = ()=>{
		let forcedSaveInterval:number = <number> vscode.workspace.getConfiguration().get('Force Save Interval');
		this.forcedSaveTimerID = setTimeout(() => {
			vscode.workspace.saveAll(false);
			this.intervalForceSave();
		}, forcedSaveInterval*60*1000);
	}
	
	//  this listener didnt get called wehn I used in special character heavy path, so combining this with onSave listener for now
	/**
	 * Calculates the increase in acitve code time and stores in 'studentData.json' present in 'Data' folder
	 */
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
	/**
	 * Runs and commits the code with a cooldown time of 10 seconds to prevent high amount of commits and calculates and stores increased active code time without cooldown.
	 * This will be called whenever save event happens.
	 * @param e 
	 */
	private onSaveHandler = (e: vscode.TextDocument)=>{
		console.log('onSaveHandler: save triggered event '); 
		// Giving cooldown of 10 seconds between auto commits on save
		// 
		if(this.saveProgresstimerID === null){
			this.run(false);
			this.saveProgresstimerID = setTimeout(()=>{
				this.saveProgresstimerID = null;
			}, 10*1000);
		}
		this.onFileChangeHandler();
	}
}
/**
 * 
 * @ignore
 */
function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

