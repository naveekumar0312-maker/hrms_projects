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

    def validate(self, attrs):
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
