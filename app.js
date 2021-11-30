const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const generatePreview = require('ffmpeg-generate-video-preview')
const ThumbnailGenerator = require('video-thumbnail-generator').default;


const { 
    v1: uuidv1,
    v4: uuidv4,
  } = require('uuid');
  

const port = 3100;

const fs = require('fs');
const AWS = require('aws-sdk');
const { join } = require("path")

const { rejects } = require('assert');
const s3 = new AWS.S3({
  accessKeyId: 'AKIAR5GJGX34XOQ2I7VX',
  secretAccessKey: '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'
});

const pdf = require('pdf-thumbnail');

const uuid = uuidv1();

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

const url = "https://tribez-backend-app.s3.ap-south-1.amazonaws.com/";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        cb(null, uuid+'-'+file.originalname);
    }
});
const fileFilter = (req, file, cb) => {
    console.log(file.mimetype);
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png' || file.mimetype == 'application/pdf' || file.mimetype.includes('video')) {
        cb(null, true);
    } else {
        cb(null, false);
    }
}

const generateVideoPreview = async (file) => {
    console.log('Video file found - ', file);
    // const metadata = await generatePreview({
    //     input: 'uploads/'+uuid+'-'+file.originalname,
    //     output: 'preview.gif',
    //     width: 128
    //   })
       
    //   console.log(metadata)

      const tg = new ThumbnailGenerator({
        sourcePath: 'uploads/'+uuid+'-'+file.originalname,
        thumbnailPath: 'uploads/',
        // tmpDir: '/some/writeable/directory' //only required if you can't write to /tmp/ and you need to generate gifs
      });

   
     tg.generateGifCb((err, result) => {
        console.log(result);
        fs.rename(result, 'uploads/'+uuid+'-'+file.originalname, ()=> {
            console.log('file renamed');
        })
        // '/full/path/to/video-1493133602092.gif'
      })

     
}

const generateThumbnailForPDF = (file) => {

    const thumbnailName = file.originalname.split('.');
    
    pdf(fs.readFileSync(join(__dirname, "uploads", uuid+'-'+file.originalname)), {
        compress: {
          type:"JPEG",
          quality: 70
        }
      })
        .then(data /*is a buffer*/ => 
            {
                const wstream = fs.createWriteStream(join(__dirname, "uploads", 'thumbnail-'+uuid+'-'+thumbnailName[0]+".jpg"))
                wstream.on('finish', function() {
                    //console.log('.jpg');
                    //console.log(thumbnailName[0]+'.jpg');
                    uploadImage({originalname: thumbnailName[0]+'.jpg'}, 'thumbnail');
                })
                data.pipe(wstream);
            })
        .catch(err => console.error(err))

}

const uploadImage = (file, type) =>{
    console.log("Uploading file");
    var fileName = file.originalname;
    var fileKey = file.originalname;
    if(type == 'original'){
        fileName = 'uploads/' + uuid+'-'+file.originalname
        fileKey = uuid+'-'+file.originalname
    }else {
        fileName = 'uploads/' + 'thumbnail-'+uuid+'-'+file.originalname
        fileKey = 'thumbnail-'+uuid+'-'+file.originalname
    }
    console.log(fileName)
    const readStream = fs.createReadStream(fileName);
    const params = {
        Bucket: 'tribez-backend-app',
        Key: fileKey,
        ContentType: file.mimetype,
        Body: readStream,
        ContentDisposition: 'inline',
        ACL:'public-read'
    };

    return new Promise((resolve, reject) => {
        s3.upload(params, function(err, data) {
          readStream.destroy();
          
          if (err) {
              console.log("err");
            return reject(err);
          }
          
          //console.log("done");
          console.log(data);
          return resolve(data);
        });
      });
    
}

const upload = multer({ storage: storage, fileFilter: fileFilter });

//Configure sharp

//Upload route
app.post('/upload', upload.single('image'), (req, res, next) => {
    console.log('File details - ',req.file);
    try {
        if(req.file && req.file.mimetype == 'application/pdf'){
            uploadImage(req.file, 'original');
            //console.log('file type pdf supported');
            const thumbnailName = req.file.originalname.split('.');
            generateThumbnailForPDF(req.file);
            return res.status(201).json({
                message: 'File (PDF) uploded successfully',
                fileUrl: url+uuid+'-'+req.file.originalname,
                thumbnailUrl: url+'thumbnail-'+uuid+'-'+thumbnailName[0]+'.jpg'
            });
        } else if (req.file && (req.file.mimetype == 'image/jpeg' || req.file.mimetype == 'image/png') ) {
            uploadImage(req.file, 'original');
            //console.log('file type supported');
            sharp(req.file.path).resize(200, 200).toFile('uploads/' + 'thumbnail-'+uuid+'-'+req.file.originalname, (err, resizeImage) => {
                if (err) {
                    //console.log('Err in generating thumbanil');
                    //console.log(err);
                    return res.status(201).json({
                        message: 'Error in generating thumbnail, file uploaded'
                    });
                } else {
                    const fileName = {originalname: req.file.originalname, mimetype: req.file.mimetype};
                    uploadImage(fileName, 'thumbnail');
                    return res.status(201).json({
                        message: 'File (image) uploded successfully',
                        fileUrl: url+uuid+'-'+req.file.originalname,
                        thumbnailUrl: url+'thumbnail-'+uuid+'-'+req.file.originalname
                    });

                }
            })
            
        } else if(req.file && (req.file.mimetype.includes('video'))) {
            generateVideoPreview(req.file);
            return res.status(201).json({
                message: 'File (video) uploaded successfully',
                fileUrl: url+uuid+'-'+req.file.originalname,
                thumbnailUrl: url+'thumbnail-'+uuid+'-'+req.file.originalname
            })
        }else {
            //console.log('file type not supported');
            return res.status(201).json({
                message: 'File type not supported'
            });
        }
        
    } catch (error) {
        console.error(error);
    }
});

app.listen(port, () => console.log(`Image Thumbnail Upload app listening at port: ${port}!`));