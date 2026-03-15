package com.campusway.app;

public class LocationData {
  public double lat, lng;
  public long timestamp;
  public float speed, heading;
  
  public LocationData() {}
  
  public LocationData(double lat, double lng, 
    long timestamp, float speed, float heading) {
    this.lat = lat;
    this.lng = lng;
    this.timestamp = timestamp;
    this.speed = speed;
    this.heading = heading;
  }
}
