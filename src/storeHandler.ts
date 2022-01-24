const fs = require("fs");

function jsonReader(filePath: string, cb: any) {
  fs.readFile(filePath, (err: any, fileData: string) => {
    if (err) {
      return cb && cb(err);
    }
    try {
      const object = JSON.parse(fileData);
      return cb && cb(null, object);
    } catch (err) {
      return cb && cb(err);
    }
  });
}

export function storeTime(path: string, activeTimeIncrement: number){
    console.log('storeTime: started');
    activeTimeIncrement /= (1000*60);
    // input was in milliseconds, so converting to minutes
    // Sometimes the values gets updated as '}number' when updating just after assignment
    // is fetched, gets fixed if user clears that mess and rewrites ' "activeTime":0 '  part.
    // why??
    jsonReader(path, (err: any, student: { activeTime: number; }) => {
        if (err) {
          console.log(err);
          return;
        }
        student.activeTime += activeTimeIncrement;
        console.log("Updating");
        fs.writeFile(path, JSON.stringify(student, null, 2), (err: any) => {
          if (err) console.log("Error writing file:", err);
        });
      });
}

module.exports = { storeTime }