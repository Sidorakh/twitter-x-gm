const sqlite3 = require('sqlite3');

module.exports = class DatabaseHelper {
    
    constructor (db) {
        this.db = db;
    }
    all(sql) {
        return new Promise((resolve,reject)=>{
            this.db.all(sql,(err,row)=>{
                try {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                } catch(e) {
                    reject(e);
                }
            });
        }); 
    }
    get(sql) {
        return new Promise((resolve,reject)=>{
            try {
            this.db.get(sql,(err,row)=>{
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
            } catch(e) {
                reject(e);
            }
        }); 
    }
    run(sql){
        return new Promise((resolve,reject)=>{
            try {
                this.db.run(sql,(err)=>{
                    if (err) reject(err);
                    resolve();
                })
            } catch(e) {
                throw e;
            }
        });
    }
    stmt_all(stmt,...params) {
        return new Promise((resolve,reject)=>{
            try {
                stmt.all(...params,(err,row)=>{
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            } catch(e) {
                reject(e);
            }
        });
    }

    stmt_get(stmt, ...params) {
        return new Promise((resolve,reject)=>{
            try {
                stmt.get(...params,(err,row)=>{
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            } catch(e) {
                reject(e);
            }
        });
    }

    stmt_run(stmt, ...params) {
        return new Promise((resolve,reject)=>{
            try {
                stmt.run(...params,(err)=>{
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } catch(e) {
                reject(e);
            }
        });
    }
    get_db() {
        return this.db;
    }

}