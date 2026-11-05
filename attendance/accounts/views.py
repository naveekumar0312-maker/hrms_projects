from rest_framework import status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import LoginSerializer, ManagerLoginSerializer, UserSerializer

class LoginView(views.APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        tokens = serializer.get_tokens(user)
        
        return Response({
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class ManagerLoginView(views.APIView):
    """
    Dedicated authentication endpoint exclusively for Reporting Managers and Team Leaders.
    Validates username/email/phone + password and enforces role in ('REPORTING_MANAGER', 'TEAM_LEADER').
    Rejects Super Admin, HR, and Employee roles.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ManagerLoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        tokens = serializer.get_tokens(user)

        return Response({
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)

class LogoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # The client should discard the token. We can optionally blacklist refresh tokens here if needed.
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)

class MeView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class HRAccountListCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def _allowed(self, request):
        return request.user.is_authenticated and request.user.role == "SUPER_ADMIN"

    def get(self, request):
        if not self._allowed(request):
            return Response({"detail": "Super Admin access required."}, status=403)

        from .models import User
        from .serializers import HRAccountSerializer

        users = User.objects.filter(role="HR").select_related("company").order_by("username")
        serializer = HRAccountSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not self._allowed(request):
            return Response({"detail": "Super Admin access required."}, status=403)

        from .serializers import HRAccountSerializer

        serializer = HRAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(HRAccountSerializer(user).data, status=status.HTTP_201_CREATED)


class HRAccountDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def _allowed(self, request):
        return request.user.is_authenticated and request.user.role == "SUPER_ADMIN"

    def _get_hr(self, pk):
        from .models import User
        return User.objects.filter(pk=pk, role="HR").first()

    def patch(self, request, pk):
        if not self._allowed(request):
            return Response({"detail": "Super Admin access required."}, status=403)

        user = self._get_hr(pk)
        if user is None:
            return Response({"detail": "HR account not found."}, status=404)

        from .serializers import HRAccountSerializer

        serializer = HRAccountSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(HRAccountSerializer(user).data)

    def delete(self, request, pk):
        if not self._allowed(request):
            return Response({"detail": "Super Admin access required."}, status=403)

        user = self._get_hr(pk)
        if user is None:
            return Response({"detail": "HR account not found."}, status=404)

        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({
            "message": "HR account deactivated.",
            "id": user.pk,
            "is_active": user.is_active,
        })
