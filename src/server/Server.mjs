import fs from 'fs';
import RequestHandler from './RequestHandler.mjs';
import dotenv from 'dotenv';
import MongoDB from 'mongodb';

/**
 * @description Handles core functions and server startup
 */
export default class Server {
    constructor() {
        dotenv.config();
        this.requestHandler = {};
        this.eventClasses = {};
        this.repositories = {};
        this.serverPath = `${process.cwd()}/src/server`;

        this.startup();
    }


    /**
     * @description Starts the server
     */
    async startup() {
        try {
            this.mongoConnection = await this.establishMongoConnection();
            await this.loadModules();

            this.requestHandler = new RequestHandler(this.events, this.eventClasses);
        } catch (err) {
            console.log(err.toString());
            process.exit();
        }
    }


    /**
     * @description Connect to MongoDB.
     * @returns {MongoDB.connect} Returns open MongoDB connection.
     */
    async establishMongoConnection() {
        return await MongoDB.MongoClient.connect(process.env.MONGO_DB, {
            useNewUrlParser: true
        });
    }


    /**
     * @description Loads events.json and creates object.
     * @returns {Object} Returns object of events.
     */
    getConfig() {
        if (!this.events) {
            this.events = JSON.parse(fs.readFileSync(`${this.serverPath}/config/events.json`));
        }

        return this.events;
    }


    /**
     * @description Loads Eventclasses, based on events.json-file.
     */
    async loadModules() {
        this.getConfig();

        for (let eventName of Object.keys(this.events)) {
            const className = this.events[eventName].class;

            if (!this.eventClasses[className]) {
                const module = await this.importModule(className);
                this.eventClasses[className] = new module.default();
                let eventClass = this.eventClasses[className];

                for (let repository of eventClass.getRepositories()) {
                    if (!eventClass.repositories[repository]) {
                        eventClass.addRepository(await this.getRepository(repository));
                    }
                }
            }
        }
    }


    /**
     * @description Loads repositories and stores them in memory.
     * @param {string} repositoryName Represents the repositorys className.
     * @returns {Promise<*>} Returns Promise containing repository.
     */
    async getRepository(repositoryName) {
        if (!this.repositories[repositoryName]) {
            await this.importModule(repositoryName, 'Database').then(repository => {
                this.repositories[repositoryName] = new repository.default(this.mongoConnection);
            });
        }

        return this.repositories[repositoryName];
    }


    /**
     * @description Import EventClass-Module, based on it's name.
     * @param {string} className The EventClass to be loaded from Events-Folder.
     * @param {string} path Path to class file.
     * @returns {Promise<*>} Returns promise, if import finished.
     */
    async importModule(className, path = 'Events') {
        return await import(`file://${this.serverPath}/${path}/${className}.mjs`);
    }
}
