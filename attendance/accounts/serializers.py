from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    company_id = serializers.IntegerField(read_only=True, allow_null=True)
    company_slug = serializers.CharField(source='company.slug', read_only=True, allow_null=True)
    company_name = serializers.CharField(source='company.name', read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'phone_number', 'role',
            'company_id', 'company_slug', 'company_name',
            'is_superuser', 'is_staff'
        ]

class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    identifier = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    company_slug = serializers.SlugField(required=False, allow_blank=True, allow_null=True)
    target_portal = serializers.ChoiceField(
        choices=['super-admin', 'hr', 'manager', 'general', 'employee'],
        required=False,
        default='general'
    )

    def validate(self, data):
        phone_number = data.get('phone_number')
        username = data.get('username')
        ident_field = data.get('identifier')
        password = data.get('password')
        target_portal = data.get('target_portal', 'general')

        user = None
        # Handle identifier matching (support username, email, phone number, employee code, or employee full name)
        identifier = (username or phone_number or ident_field or '').strip()
        if identifier and password:
            # Build search variants for identifier (including phone variations)
            digits_only = ''.join(c for c in identifier if c.isdigit())
            phone_variants = [identifier]
            if digits_only:
                phone_variants.append(digits_only)
                if len(digits_only) > 10 and digits_only.startswith('91'):
                    phone_variants.append(digits_only[2:])
            phone_variants = list(set(phone_variants))

            user_candidates = User.objects.filter(
                Q(username__iexact=identifier) |
                Q(email__iexact=identifier) |
                Q(phone_number__in=phone_variants) |
                Q(employee_profile__employee_id__iexact=identifier) |
                Q(employee_profile__email__iexact=identifier) |
                Q(employee_profile__full_name__iexact=identifier)
            ).distinct()

            for candidate in user_candidates:
                if candidate.check_password(password):
                    user = candidate
                    break
        else:
            raise serializers.ValidationError({
                'detail': 'Please provide both your login identifier and password.'
            })
            
        if not user:
            raise serializers.ValidationError({
                'detail': 'Invalid username or password.'
            })
            
        if not user.is_active:
            raise serializers.ValidationError({
                'detail': 'Your account is inactive. Please contact the administrator.'
            })

        # Check linked employee profile status if user is an employee
        emp = getattr(user, 'employee_profile', None)
        if emp is not None:
            if hasattr(emp, 'status') and emp.status is False:
                raise serializers.ValidationError({
                    'detail': 'Your employee account is inactive. Please contact your administrator.'
                })
            if hasattr(emp, 'employment_status') and emp.employment_status not in ('ACTIVE', 'PROBATION', None, ''):
                raise serializers.ValidationError({
                    'detail': f'Your employee account status is {emp.employment_status.lower()}. Access is restricted.'
                })

        # Check tenant company active status
        if user.company_id and hasattr(user, 'company') and user.company:
            if not user.company.status:
                raise serializers.ValidationError({
                    'detail': 'Your company account is inactive. Please contact support.'
                })

        # Portal-specific backend enforcement
        if target_portal == 'super-admin':
            is_super = user.role == 'SUPER_ADMIN' or (user.role == 'ADMIN' and (user.is_superuser or user.is_staff))
            if not is_super:
                raise serializers.ValidationError({
                    'detail': 'Access denied. Super Admin privileges required.'
                })
        elif target_portal == 'hr':
            if user.role != 'HR':
                raise serializers.ValidationError({
                    'detail': 'Access denied. This login is reserved for HR accounts.'
                })
        elif target_portal == 'manager':
            if user.role not in ('REPORTING_MANAGER', 'TEAM_LEADER'):
                raise serializers.ValidationError({
                    'detail': 'Access denied. This portal is strictly for Reporting Managers and Team Leaders.'
                })

        company_slug = (data.get('company_slug') or '').strip()
        if company_slug:
            from companies.models import Company

            company = Company.objects.filter(
                slug=company_slug,
                status=True,
            ).first()

            if company is None:
                raise serializers.ValidationError({
                    'detail': 'Company login page not found or inactive.'
                })

            if user.role != 'SUPER_ADMIN' and user.company_id != company.id:
                raise serializers.ValidationError({
                    'detail': 'Your account does not belong to this company.'
                })
        elif target_portal in ('hr', 'manager'):
            # HR and Manager logins require a valid company context
            if not user.company_id:
                raise serializers.ValidationError({
                    'detail': f'{user.get_role_display()} user is not assigned to any active company.'
                })

        data['user'] = user
        return data

    def get_tokens(self, user):
        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
        refresh['company_id'] = user.company_id
        refresh['company_slug'] = user.company.slug if user.company else None
        refresh['is_superuser'] = user.is_superuser
        refresh['is_staff'] = user.is_staff
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }


class ManagerLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = (attrs.get('username') or '').strip()
        password = attrs.get('password')

        if not identifier or not password:
            raise serializers.ValidationError({
                'detail': 'Please provide both username/email/phone and password.'
            })

        user_obj = User.objects.filter(
            Q(username__iexact=identifier) |
            Q(email__iexact=identifier) |
            Q(phone_number__iexact=identifier)
        ).first()

        if not user_obj or not user_obj.check_password(password):
            raise serializers.ValidationError({
                'detail': 'Invalid username or password.'
            })

        if not user_obj.is_active:
            raise serializers.ValidationError({
                'detail': 'Your account is inactive. Please contact the administrator.'
            })

        if user_obj.role not in ('REPORTING_MANAGER', 'TEAM_LEADER'):
            raise serializers.ValidationError({
                'detail': 'Access denied. This portal is strictly for Reporting Managers and Team Leaders.'
            })

        if not user_obj.company_id:
            raise serializers.ValidationError({
                'detail': 'User account is not assigned to any active company.'
            })

        attrs['user'] = user_obj
        return attrs

    def get_tokens(self, user):
        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
        refresh['company_id'] = user.company_id
        refresh['company_slug'] = user.company.slug if user.company else None
        refresh['is_superuser'] = user.is_superuser
        refresh['is_staff'] = user.is_staff
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }


from companies.models import Company


class HRAccountSerializer(serializers.ModelSerializer):
    company_id = serializers.PrimaryKeyRelatedField(
        source="company",
        queryset=Company.objects.filter(status=True),
        required=True,
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = [
            "id", "username", "phone_number", "role",
            "company_id", "is_active", "password",
        ]
        read_only_fields = ["id", "role"]

    def validate_username(self, value):
        qs = User.objects.filter(username=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already in use.")
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({
                "password": "Password is required when creating an HR account."
            })
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data, role="HR", is_staff=False, is_superuser=False)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.role = "HR"
        instance.is_staff = False
        instance.is_superuser = False
        instance.save()
        return instance
