import { exec, spawn, ChildProcessWithoutNullStreams } from 'child_process'

const path = require("path");

//  marking stderr to message cause docker compose uses stderr to log the outputs for some reason
//  https://github.com/docker/compose/issues/7346

/**
 * Stats available for docker command executed.
 */
export type dockerReturn = {
    stdout: string;
    message: string;
    code: number | null;
    signal: string | null;
    time: number;
};
/**
 * Class handling all docker activities.
 */
export class DockerHandler {
    /** Base directory with respect to which docker commands are to be run. */
    private workDir: string;
    
    /**  Name of the container to be built and used.*/
    private containerName: string;

    constructor(workDir: string, containerName: string){
        this.workDir = workDir;
        this.containerName = containerName;
    }

    /**
     * 
     *  Executes docker commands according to input.
     *  Input to command mapping -
     * 
     * `start` ->  `docker-compose -f ymlPath up -d`.
     * 
     * `run` -> `docker exec -i containerName make`.
     * 
     * `shut down` -> `docker-compose -f ymlPath down`.
     * 
     * 
     * @param command shorthand for which command to be executed (should be one of these - 'start', 'run', 'shut down'). 
     * @returns promise which gives stats related to the command that ran.
     */
    exec(command: string): Promise<dockerReturn>{
        let process: ChildProcessWithoutNullStreams|null = null;
        const spawnOpts = {
            cwd: this.workDir
        };
        const result: dockerReturn = {
            stdout: 'Docker: ',
            message: 'Docker: ',
            code: null,
            signal: null,
            time: 0,
        };
    	let ymlPath = path.join('.', 'Data', 'docker-compose.yml');
        switch(command){
            case 'start':{
                process = spawn(
                    "docker-compose", 
                    ["-f", ymlPath, "up", "-d"], 
                    spawnOpts
                );
                break;
            }
            case 'run':{
                // running with -it flag gives "the input device is not a TTY" error
                // https://serverfault.com/questions/897847/what-does-the-input-device-is-not-a-tty-exactly-mean-in-docker-run-output
                process = spawn(
                    "docker",
                    ["exec", "-i", this.containerName, "make"],
                );
                break;
            }
            case 'shut down':{
                process = spawn(
                    "docker-compose", 
                    ["-f", ymlPath, "down"], 
                    spawnOpts
                );
                break;
            }
        }

        const begin = Date.now();
        const ret: Promise<dockerReturn> = new Promise((resolve, reject) => {
            
            if(process === null) reject('command not allowed');
            else{
                process.on('exit', (code, signal) => {
                    const end = Date.now();
                    result.code = code;
                    result.signal = signal;
                    result.time = Math.round((end - begin)/100)/10;
                    console.log('Run Result:', result);
                    resolve(result);
                });
        
                process.stdout.on('data', (data) => {
                    result.stdout += data;
                });
                process.stderr.on('data', (data) => (result.message += data));
                process.on('error', (err) => {
                    const end = Date.now();
                    result.code = 1;
                    result.signal = err.name;
                    result.message = `Docker: ${err.message}`;
                    result.time = Math.round((end - begin)/100)/10;
                    console.log('Run Error Result:', result);
                    reject(result);
                });
            }
        });
    
        return ret;


    }

}