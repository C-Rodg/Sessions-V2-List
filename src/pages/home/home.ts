import { Component, NgZone } from '@angular/core';
import { AlertController } from 'ionic-angular';
import * as moment from 'moment';

import { ScanCameraService } from '../../providers/scanCameraService';
import { EventsService } from '../../providers/eventsService';


@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  showCamera: boolean = false;
  largeBtnText: string = "Add New Event";

  events = [];

  constructor(
    private scanCameraService: ScanCameraService,
    private eventsService: EventsService,
    private zone: NgZone,
    private alertCtrl: AlertController,
  ) {
  }

  // Get Events
  ionViewWillEnter() {
    this.eventsService.getEvents().subscribe((data) => {      
      this.events = this.sortByStartDate(data);
      console.log(this.events);
    }, (err) => {});
  }

  // Set OnDataRead
  ionViewDidEnter() {
    (<any>window).OnDataRead = this.onZoneDataRead.bind(this);
  }


  // OnDataRead called
  onZoneDataRead(data) {
    this.zone.run(() => {
      this.handleEventScan(data);
    });
  }

  // Download Event
  handleEventScan(data) {
    
  }

  // Update Event
  updateEvent(event) {
    if (window.navigator.onLine) {
      this.eventsService.checkForUpdates(event).subscribe((data) => {

      }, (err) => {

      });
    } else {
      this.eventsService.showToast('Please check your internet connection...', true);
    }    
    return false;
  }

  // Delete Event
  deleteEvent(event) {    
    let prompt = this.alertCtrl.create({
      title: 'Delete Event',
      message: 'Please enter the admin password to confirm event deletion.',
      inputs: [
        {
          name: 'password',
          placeholder: 'Password'
        }
      ],
      buttons: [
        {
          text: 'Keep',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: data => {
            this.confirmDeleteEvent(data.password, event.EventGuid);
          }
        }
      ]
    });
    prompt.present();
    return false;
  }

  // Validate password, delete event
  confirmDeleteEvent(pass, eg) {
    if (pass === '9151') {
      this.eventsService.deleteEvent(eg).subscribe((d) => {        
        this.events = this.events.filter((event) => event.EventGuid !== eg);
        this.eventsService.showToast("Event has been removed.", false);
      }, (err) => {
        this.eventsService.showToast('There was an issue deleting that event..', true);
      });      
    } else {
      this.eventsService.showToast('Incorrect password...', true);
    }
  }

  // Launch Event
  launchEvent(event) {   
    window.location.href = `http://localhost/navigate/${event.EventGuid}` ;
    return false;
  }

  // Toggle show/hide camera
  scanEventCode() {
    if (!this.showCamera) {
      this.scanCameraService.calculatePosition();
      this.scanCameraService.turnOn();
      this.largeBtnText = "Shut Off Camera";
      this.showCamera = true;      
    } else {
      this.scanCameraService.turnOff();
      this.largeBtnText = "Add New Event";
      this.showCamera = false;
    }
  }

  // Toggle camera direction
  toggleCamera() {
    this.scanCameraService.toggleCamera();
  }

  // Helper - Sort by start date
  sortByStartDate(arr) {
    return arr.sort((a, b) => {
      return moment(b.StartDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ').diff(moment(a.StartDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ'));
    });
  }  
}
