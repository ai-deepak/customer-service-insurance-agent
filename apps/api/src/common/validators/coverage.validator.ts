import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'isGreaterThanCurrent', async: false })
export class IsGreaterThanCurrentConstraint implements ValidatorConstraintInterface {
  validate(newCoverage: number, args: ValidationArguments) {
    const object = args.object as any;
    const currentCoverage = object.current_coverage;
    return newCoverage > currentCoverage;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    return `New coverage ($${args.value?.toLocaleString()}) must be greater than current coverage ($${object.current_coverage?.toLocaleString()})`;
  }
}
