# Assignment-Fetcher
This is a vscode extension that provides functionalities on assignments following specific structure and fetched using github classroom. Functionalities include - starting and switching off containers associated with the project directory, Track and store active code time, auto run code in container & commit on save, forced auto save according to specified interval, push to repository using a button. 

## Requirements
1. Git and github classroom ewxtension should be installed and working with vscode.
2. Docker & Docker-Compose should be installed and working without sudo command.
3. Extension settings should be filled completely in vscode.
4. The initial directory for assignment repository should be fetched and amde using github classroom.
5. The assignment folder/repostory should follow the strict structure of having the `Data` folder immediately inside the assigment folder/repository with `docker-compose.yml`, `Dockerfile`, `studentData.json` with `"activeTime"` key set to `0` beforehand and `metadata.json` with `"container_name"` set beforehand.

## Explicit Features
1. `Start container`: starts a container using docker-compose.yml.
2. `Submit Progress`: pushes to the repository set up by github classroom.
3. `Run`: runs the code in the container.

`2` and `3` will be visible only after starting the container and will be hidden otherwise.

## Implicit Features
1. `Auto run and commit`: each save will trigger run and commit silently.
2. `Active code time`: amount of time spent coding which stops after each inactivity of duration specified by `Timer Shutdown Interval`.
3. `Forced Save after predefined intervals`: after each duration specified by `Force Save Interval` all files inside the assignment folder will be saved.

## Extension Settings
1. `Force Save Interval`: Minutes after which files will be automatically saved periodically. 
2. `Timer Shutdown Interval`: Minutes after which user is marked inactive.

After changing settings, restarting vscode is encouraged.