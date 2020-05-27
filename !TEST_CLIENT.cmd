@echo off
cd src
cd app
IF EXIST "*.jsc" DEL "*.jsc" /s
cd..
npm run start --dev
exit