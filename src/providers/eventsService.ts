import { Injectable } from '@angular/core';
import { ToastController } from 'ionic-angular';
import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/forkJoin'
import 'rxjs/add/operator/mergeMap';
import * as moment from 'moment';

@Injectable()
export class EventsService {

    constructor(private http: Http, private toastCtrl: ToastController) {

    }

    // Login, Get BundleHash, DownloadContent, resolve
    // ^^^^^>> InitateChallenge, ComputeHash, ValidateChallenge 

    // Check for updates to an event
    checkForUpdates(event) {
        let ev = this.cleanEvent(event);
        let context = {
            event: ev,
            EventGuid: ev.EventGuid,
            authCode: ev.AuthCode,
            authGuid: ev.AuthGuid,
            LoginRestUrl: ev.LoginUrl,
            SessionRestUrl: ev.SessionUrl
        };
    }  

    // Login to Validar Services
    login(context) {
        let loginArgs = {
            loginRestUrl: context.LoginRestUrl
        };
        loginArgs['authCode'] = context.authCode ? context.authCode : context.configurationKey.configuration.authCode;
        loginArgs['authGuid'] = context.authCode ? context.authGuid : context.configurationKey.configuration.authGuid;
    }  

    // Initate Challenge (login #1)
    initiateChallenge(loginArgs) {

    }

    // Compute Hash (login #2)
    computeHash() {

    }

    // Validate Challenge (login #3)
    validateChallenge() {

    }

    // Delete an event
    deleteEvent(eg) {
        return this.http.delete(`http://localhost/events/${eg}`).map(d => d.json());
    }

    // Get Events with display dates, pending and total counts
    getEvents() {
        return this.allEvents().flatMap((events) => {
            let totalBatch = [];
            events.forEach((event, i) => {
                totalBatch.push(Observable.forkJoin(this.getScanCount(event.EventGuid, ''), this.getScanCount(event.EventGuid, 'uploaded=no&error=no')).map((rez) => {
                    events[i].TotalCount = rez[0].Count;
                    events[i].PendingCount = rez[1].Count;
                    const start = moment(events[i].StartDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ');
                    const end = moment(events[i].EndDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ');
                    events[i].DisplayDate = `${start.format('ddd, MMM Do')} - ${end.format('ddd, MMM Do, YYYY')}`;
                    return events[i];
                }));
            });  
            return Observable.forkJoin(totalBatch);          
        });
    }

    // Clean Event
    cleanEvent(event) {
        delete event.TotalCount;
        delete event.PendingCount;
        delete event.DisplayDate;
        return event;
    }

    // Return local events
    allEvents() {
        return this.http.get('http://localhost/events').map(d => d.json()).map(d => d.Events);
    }

    // Get Total or Pending Count for an event
    getScanCount(eg, opts) {
        return this.http.get(`http://localhost/events/${eg}/sessions/scans/count?${opts}`).map(d => d.json());
    }

    // Get Client info 
    getClientInfo() {
        return this.http.get('http://localhost/clientinfo').map(d => d.json());
    }

    // Helper - Show notification
    showToast(msg, isError) {
        let toast = this.toastCtrl.create({
        message: msg,
        duration: 3000,
        position: 'top',
        cssClass: isError ? 'error-notify' : ''
        });
        toast.present();
    }
}