@echo off
chcp 65001 > nul
title Echo Çift Kullanıcı Test Başlatıcı
echo ======================================================
echo   Echo - Çift Kullanıcı Test Ortamı Başlatılıyor
echo ======================================================
echo.

if not exist "%~dp0apps\desktop\dist\win-unpacked\Echo.exe" (
  echo [HATA] Derlenmiş Echo.exe bulunamadı!
  echo Lütfen önce terminalde "pnpm build:exe" çalıştırın.
  echo.
  pause
  exit /b 1
)

echo [1/2] 1. Kullanıcı açılıyor (Sol Ekran)...
start "" "%~dp0apps\desktop\dist\win-unpacked\Echo.exe"

timeout /t 2 /nobreak > nul

echo [2/2] 2. Kullanıcı açılıyor (Sağ Ekran - Profil: user2)...
start "" "%~dp0apps\desktop\dist\win-unpacked\Echo.exe" --profile=user2

echo.
echo ======================================================
echo  [BASARILI] Her iki pencere yan yana açıldı!
echo.
echo  Nasıl test edilir?
echo  1. Sol penceredeki grubun davet kodunu kopyalayın.
echo  2. Sağ pencerede "+" butonuna tıklayıp koda katılın.
echo  3. İki taraftan da ses kanalına girin; ses, konuşma
echo     halkaları ve arka planda ses düşmeme durumunu test edin!
echo ======================================================
echo.
timeout /t 5 > nul
