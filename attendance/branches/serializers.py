from rest_framework import serializers
from .models import Branch
from attendance.models import AttendancePolicy

class AttendancePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendancePolicy
        fields = ['start_time', 'end_time', 'grace_period', 'allowed_radius']

class BranchSerializer(serializers.ModelSerializer):
    attendance_policy = AttendancePolicySerializer(required=False)

    class Meta:
        model = Branch
        fields = '__all__'
        extra_kwargs = {
            'branch_name': {'required': False},
            'office_address': {'required': False},
        }

    def to_internal_value(self, data):
        # Support aliases sent from mobile and web forms: name -> branch_name, address -> office_address, radius -> allowed_radius
        data_copy = dict(data)
        if 'name' in data_copy and 'branch_name' not in data_copy:
            data_copy['branch_name'] = data_copy.pop('name')
        if 'address' in data_copy and 'office_address' not in data_copy:
            data_copy['office_address'] = data_copy.pop('address')
        if 'radius' in data_copy and 'allowed_radius' not in data_copy:
            data_copy['allowed_radius'] = data_copy.pop('radius')
        if 'is_active' in data_copy and 'status' not in data_copy:
            data_copy['status'] = data_copy.pop('is_active')

        # Fallback if office_address is empty or missing
        if not data_copy.get('office_address'):
            data_copy['office_address'] = data_copy.get('branch_name') or 'Office Address'

        return super().to_internal_value(data_copy)

    def validate(self, attrs):
        if not attrs.get('branch_name'):
            raise serializers.ValidationError({'branch_name': 'Branch name is required.'})

        request = self.context.get('request')
        user = getattr(request, 'user', None)

        if (
            user
            and user.is_authenticated
            and user.role == 'HR'
            and user.company_id
        ):
            company = attrs.get(
                'company',
                self.instance.company if self.instance else None,
            )

            if company is not None and company.pk != user.company_id:
                raise serializers.ValidationError({
                    'company': 'You can only manage branches in your assigned company.'
                })

            if company is None and self.instance is None:
                from companies.models import Company
                attrs['company'] = Company.objects.get(pk=user.company_id)

        # For Super Admin / Admin, if company is not provided and there's a default or first company, assign it
        if not attrs.get('company') and self.instance is None:
            from companies.models import Company
            first_company = Company.objects.first()
            if first_company:
                attrs['company'] = first_company

        return attrs

    def to_representation(self, instance):
        response = super().to_representation(instance)
        # Compatibility aliases so frontend item.name / item.radius / item.address work seamlessly
        response['name'] = instance.branch_name
        response['radius'] = instance.allowed_radius
        response['address'] = instance.office_address
        response['is_active'] = instance.status
        if instance.company:
            response['company_name'] = instance.company.name
        return response

    def create(self, validated_data):
        policy_data = validated_data.pop('attendance_policy', None)
        branch = Branch.objects.create(**validated_data)
        if policy_data:
            AttendancePolicy.objects.create(branch=branch, **policy_data)
        else:
            # Create a default policy if none provided
            from datetime import time
            AttendancePolicy.objects.create(
                branch=branch, 
                start_time=time(9, 36), 
                end_time=time(18, 0)
            )
        return branch

    def update(self, instance, validated_data):
        policy_data = validated_data.pop('attendance_policy', None)
        
        # Update branch fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update policy fields
        if policy_data:
            policy, created = AttendancePolicy.objects.get_or_create(branch=instance)
            for attr, value in policy_data.items():
                setattr(policy, attr, value)
            policy.save()

        return instance
