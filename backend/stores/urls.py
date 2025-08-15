# stores/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('nearby/', views.nearby_stores, name='nearby_stores'),
    path('search/', views.search_stores, name='search_stores'),
]
