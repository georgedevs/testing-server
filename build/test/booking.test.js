"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
const bookingModel_1 = require("../models/bookingModel");
const userModel_1 = require("../models/userModel");
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("../utils/redis");
describe('Booking Controllers', () => {
    let clientToken;
    let counselorToken;
    let adminToken;
    let testClient;
    let testCounselor;
    let testAdmin;
    let testMeeting;
    beforeAll(async () => {
        // Create test users
        testClient = await userModel_1.Client.create({
            email: 'testclient@test.com',
            password: 'password123',
            isVerified: true
        });
        clientToken = testClient.signAccessToken();
        testCounselor = await userModel_1.Counselor.create({
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
        testAdmin = await userModel_1.Admin.create({
            email: 'testadmin@test.com',
            password: 'password123',
            isVerified: true,
            fullName: 'Test Admin'
        });
        adminToken = testAdmin.signAccessToken();
    });
    afterAll(async () => {
        await bookingModel_1.Meeting.deleteMany({});
        await userModel_1.Client.deleteMany({});
        await userModel_1.Counselor.deleteMany({});
        await userModel_1.Admin.deleteMany({});
        await mongoose_1.default.connection.close();
        await redis_1.redis.quit();
    });
    describe('GET /available-slots', () => {
        it('should return available time slots', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const response = await (0, supertest_1.default)(app_1.app)
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
            const response = await (0, supertest_1.default)(app_1.app)
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
            const response = await (0, supertest_1.default)(app_1.app)
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
            const response = await (0, supertest_1.default)(app_1.app)
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
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/booking/assign-counselor')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                meetingId: new mongoose_1.default.Types.ObjectId(),
                counselorId: testCounselor._id
            });
            expect(response.status).toBe(404);
        });
    });
    describe('POST /accept', () => {
        it('should allow counselor to accept meeting', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
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
            const response = await (0, supertest_1.default)(app_1.app)
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
            const response = await (0, supertest_1.default)(app_1.app)
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
