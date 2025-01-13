import request from 'supertest';
import { app } from '../app';
import { Meeting } from '../models/bookingModel';
import { Client, Counselor, Admin } from '../models/userModel';
import mongoose from 'mongoose';
import { redis } from '../utils/redis';

describe('Booking Controllers', () => {
  let clientToken: string;
  let counselorToken: string;
  let adminToken: string;
  let testClient: any;
  let testCounselor: any;
  let testAdmin: any;
  let testMeeting: any;

  beforeAll(async () => {
    // Create test users
    testClient = await Client.create({
      email: 'testclient@test.com',
      password: 'password123',
      isVerified: true
    });
    clientToken = testClient.signAccessToken();

    testCounselor = await Counselor.create({
      email: 'testcounselor@test.com',
      password: 'password123',
      isVerified: true,
      fullName: 'Test Counselor',
      isAvailable: true,
      gender: 'male',
      availability: [{
        dayOfWeek: new Date().getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true
      }]
    });
    counselorToken = testCounselor.signAccessToken();

    testAdmin = await Admin.create({
      email: 'testadmin@test.com',
      password: 'password123',
      isVerified: true,
      fullName: 'Test Admin'
    });
    adminToken = testAdmin.signAccessToken();
  });

  afterAll(async () => {
    await Meeting.deleteMany({});
    await Client.deleteMany({});
    await Counselor.deleteMany({});
    await Admin.deleteMany({});
    await mongoose.connection.close();
    await redis.quit();
  });

  describe('GET /available-slots', () => {
    it('should return available time slots', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const response = await request(app)
        .post('/api/v1/booking/available-slots')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          date: tomorrow.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.availableSlots)).toBe(true);
    });
  });

  describe('POST /book', () => {
    it('should create a new meeting booking', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/v1/booking/book')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          meetingType: 'virtual',
          issueDescription: 'Test issue',
          meetingDate: tomorrow.toISOString(),
          meetingTime: '10:00'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.meeting).toBeDefined();
      testMeeting = response.body.meeting;
    });

    it('should not allow booking less than 24 hours in advance', async () => {
      const response = await request(app)
        .post('/api/v1/booking/book')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          meetingType: 'virtual',
          issueDescription: 'Test issue',
          meetingDate: new Date().toISOString(),
          meetingTime: '10:00'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /assign-counselor', () => {
    it('should assign a counselor to a meeting', async () => {
      const response = await request(app)
        .post('/api/v1/booking/assign-counselor')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          meetingId: testMeeting._id,
          counselorId: testCounselor._id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail with invalid meeting ID', async () => {
      const response = await request(app)
        .post('/api/v1/booking/assign-counselor')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          meetingId: new mongoose.Types.ObjectId(),
          counselorId: testCounselor._id
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /accept', () => {
    it('should allow counselor to accept meeting', async () => {
      const response = await request(app)
        .post('/api/v1/booking/accept')
        .set('Authorization', `Bearer ${counselorToken}`)
        .send({
          meetingId: testMeeting._id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /cancel', () => {
    it('should cancel a meeting', async () => {
      const response = await request(app)
        .post('/api/v1/booking/cancel')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          meetingId: testMeeting._id,
          cancellationReason: 'Test cancellation'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /report-no-show', () => {
    it('should report a no-show', async () => {
      const response = await request(app)
        .post('/api/v1/booking/report-no-show')
        .set('Authorization', `Bearer ${counselorToken}`)
        .send({
          meetingId: testMeeting._id,
          noShowReason: 'Client did not attend'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});