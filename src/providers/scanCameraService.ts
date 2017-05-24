import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';

@Injectable()
export class ScanCameraService {
    private camera = {
        visible : "YES",
        camera : "BACK",
        top: 95, 
        left: 0,
        width: 320,
        height: 405
    };
    private endpoint : string = "http://localhost/barcodecontrol";
    private cameraOn: boolean = false;

    constructor(private http: Http
    ) {
        this.calculatePosition = this.calculatePosition.bind(this);
        this.calculatePosition();
        window.addEventListener('orientationchange', () => {
             setTimeout(this.calculatePosition, 700);
         }, false);
    }

    calculatePosition() {
        const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        this.camera.width = width;
        const target = document.querySelector('.scroll-content');
        if (target) {
            const coords = target.getBoundingClientRect();
            if (coords) {
                this.camera.top = coords.top + 30;
                this.camera.height = coords.height - 20;
            } else {
                this.camera.top = 95;
                this.camera.height = 405;
            }
        } else {
            this.camera.top = 95;
            this.camera.height = 405;
        }

        if (this.cameraOn) {
            this.turnOn();
        }
    }

    turnOn() {
        this.cameraOn = true;
        this.http.post(this.endpoint, this.camera).map(res => res.json()).subscribe((data) => { });
    }

    turnOff() {  
        this.cameraOn = false;
        this.http.post(this.endpoint, { visible: "NO" }).map(res => res.json()).subscribe((data) => {});
    }    

    toggleCamera() {
        this.camera.camera = (this.camera.camera === "FRONT") ? "BACK" : "FRONT";
        this.http.post(this.endpoint, this.camera).map(res => res.json()).subscribe((data) => {});
    }
}