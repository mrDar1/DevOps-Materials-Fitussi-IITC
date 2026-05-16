docker build -t first-distorless-image .

docker run --rm -d -p 3000:3000 --name my-app first-distorless-image

docker exec -it my-app sh 