import { validate } from 'class-validator';
import { GetClaimStatusDto, SubmitClaimDto } from './claims.dto';

describe('Claims DTOs', () => {
  describe('GetClaimStatusDto', () => {
    it('should pass validation for valid claim_id', async () => {
      const dto = new GetClaimStatusDto();
      dto.claim_id = 'ABC123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation for claim_id longer than 10 characters', async () => {
      const dto = new GetClaimStatusDto();
      dto.claim_id = 'VERYLONGCLAIMID123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should fail validation for claim_id with special characters', async () => {
      const dto = new GetClaimStatusDto();
      dto.claim_id = 'ABC@123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should fail validation for empty claim_id', async () => {
      const dto = new GetClaimStatusDto();
      dto.claim_id = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('SubmitClaimDto', () => {
    it('should pass validation for valid claim data', async () => {
      const dto = new SubmitClaimDto();
      dto.policy_id = 'POL123';
      dto.damage_description = 'Vehicle damaged in collision with another car';
      dto.vehicle = 'Toyota Camry 2020';
      dto.photos = ['photo1.jpg', 'photo2.jpg'];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation for short damage description', async () => {
      const dto = new SubmitClaimDto();
      dto.policy_id = 'POL123';
      dto.damage_description = 'short';
      dto.vehicle = 'Toyota Camry 2020';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail validation for missing required fields', async () => {
      const dto = new SubmitClaimDto();
      // Missing all required fields

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass validation without photos (optional field)', async () => {
      const dto = new SubmitClaimDto();
      dto.policy_id = 'POL123';
      dto.damage_description = 'Vehicle damaged in collision with another car';
      dto.vehicle = 'Toyota Camry 2020';
      // photos not provided

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
