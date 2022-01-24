//  @ts-noCheck

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
// console logs arent emitted here !?
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    // const oldState = vscode.getState() || { switchState: 'off' };
    var powerBtn = document.getElementsByClassName('switch')[0];
    var check = document.getElementById('check');
    var indicator = document.getElementById('indicator');
    var submitBtn = document.getElementById('submitProgress');
    var runBtn = document.getElementById('run');
    var actions = document.getElementById('actions');

    vscode.postMessage({ type: 'getState'});
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'getState':{
                if(message.isInitialized){
                    check.checked = true;
                    submitBtn.disabled = false;
                    runBtn.disabled = false;

                    actions.style.visibility = "visible";
                    actions.style.width = "100%";
                    actions.style.opacity = "100%";
                    indicator.textContent = 'ON';
                    submitBtn.style.cursor = "pointer"; 
                    runBtn.style.cursor = "pointer"; 
                }
                else{
                    check.checked = false;
                    submitBtn.disabled = true;
                    runBtn.disabled = true;

                    actions.style.width = "0%"
                    actions.style.opacity = "0%"
                    indicator.textContent = 'OFF';
                    submitBtn.style.cursor = "default"; 
                    runBtn.style.cursor = "default"; 
                }
                break;
            }
        }
    });

    powerBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('call to backend initialize')
        vscode.postMessage({type: 'initialize'});
    });
    
    submitBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'submitProgress'});
    });

    runBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'run'});
    });

}());