# subscriptions/views.py
import stripe
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Subscription
from .serializers import SubscriptionSerializer

stripe.api_key = settings.STRIPE_SECRET_KEY

@api_view(['POST'])
def create_subscription(request):
    """プレミアムプランの購読を開始"""
    try:
        # Stripeで顧客を作成/取得
        user = request.user
        if not user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.username
            )
            user.stripe_customer_id = customer.id
            user.save()
        
        # 購読を作成
        subscription = stripe.Subscription.create(
            customer=user.stripe_customer_id,
            items=[{'price': 'price_premium_monthly'}],  # Stripeで作成した価格ID
            payment_behavior='default_incomplete',
            expand=['latest_invoice.payment_intent'],
        )

        # データベースに保存
        sub, created = Subscription.objects.get_or_create(
            user=user,
            defaults={
                'stripe_subscription_id': subscription.id,
                'plan_type': 'premium',
                'status': 'inactive'
            }
        )

        return Response({
            'subscription_id': subscription.id,
            'client_secret': subscription.latest_invoice.payment_intent.client_secret
        })

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def subscription_status(request):
    """現在の購読状況を取得"""
    try:
        subscription = Subscription.objects.get(user=request.user)
        serializer = SubscriptionSerializer(subscription)
        return Response(serializer.data)
    except Subscription.DoesNotExist:
        return Response({'plan_type': 'free', 'status': 'active'})

@api_view(['POST'])
def cancel_subscription(request):
    """購読をキャンセル"""
    try:
        subscription = Subscription.objects.get(user=request.user)
        if subscription.stripe_subscription_id:
            stripe.Subscription.delete(subscription.stripe_subscription_id)
        
        subscription.status = 'canceled'
        subscription.canceled_at = timezone.now()
        subscription.save()

        user = request.user
        user.is_premium = False
        user.save()

        return Response({'message': '購読がキャンセルされました'})

    except Subscription.DoesNotExist:
        return Response({'error': '購読が見つかりません'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)