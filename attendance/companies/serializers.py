from rest_framework import serializers
from .models import Company


class CompanySerializer(serializers.ModelSerializer):
    branch_count = serializers.IntegerField(
        source="branches.count",
        read_only=True,
    )
    employee_count = serializers.SerializerMethodField()
    logo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Company
        fields = "__all__"

    def get_employee_count(self, obj):
        from employees.models import Employee

        return Employee.objects.filter(branch__company=obj).count()


class PublicCompanyBrandingSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(read_only=True)
    login_background = serializers.ImageField(read_only=True)

    class Meta:
        model = Company
        fields = (
            "slug",
            "name",
            "logo",
            "login_background",
            "tagline",
            "primary_color",
            "left_panel_heading",
            "left_panel_content",
            "footer_message",
            "left_panel_color",
            "login_button_color",
            "status",
        )


class CompanyBrandingUpdateSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(required=False, allow_null=True)
    login_background = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Company
        fields = (
            "name",
            "slug",
            "logo",
            "login_background",
            "tagline",
            "primary_color",
            "left_panel_heading",
            "left_panel_content",
            "footer_message",
            "left_panel_color",
            "login_button_color",
        )

    def validate_primary_color(self, value):
        import re
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
            raise serializers.ValidationError(
                "Enter a valid hex color, for example #E56717."
            )
        return value


    def validate_login_button_color(self, value):
        import re
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
            raise serializers.ValidationError(
                "Enter a valid hex color, for example #2563EB."
            )
        return value
