import * as vscode from 'vscode';
// import { helloWorld } from './actions';
import { sidePanelProvider } from './sidePanelProvider';

// this method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "assignmentfetcher" is now active!');
	
	if(vscode.workspace.workspaceFolders !== undefined){
		const afSidePanel = new sidePanelProvider(context.extensionUri, vscode.workspace.workspaceFolders[0].uri.fsPath );
		
		context.subscriptions.push(vscode.window.registerWebviewViewProvider(sidePanelProvider.viewType, afSidePanel));
		
		let disposable1 = vscode.commands.registerCommand('assignment-fetcher.submit-progress', afSidePanel.submitProgress);
		let disposable2 = vscode.commands.registerCommand('assignment-fetcher.run', afSidePanel.run );
		let disposable3 = vscode.commands.registerCommand('assignment-fetcher.initialize', afSidePanel.initialize);

		
		context.subscriptions.push(disposable1);
		context.subscriptions.push(disposable2);
		context.subscriptions.push(disposable3);
	}

	// let disposable = vscode.commands.registerCommand('assignmentfetcher.helloWorld', helloWorld);
	// context.subscriptions.push(disposable);
}



// this method is called when your extension is deactivated
export function deactivate() {

        // freeSpace();
}

