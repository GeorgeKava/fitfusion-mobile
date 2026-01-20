import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import { parseHeightToInches } from '../utils/heightUtils';
import { IoBarbell, IoChevronDown, IoChevronUp, IoPlay, IoInformationCircle, IoLink } from 'react-icons/io5';
import '../styles/mobile.css';

// Comprehensive exercise database with instructions and external links
const exerciseDatabase = {
  // === CHEST EXERCISES ===
  'bench press': {
    instructions: 'Lie flat on bench, grip bar slightly wider than shoulders. Lower bar to mid-chest, then press up. Keep feet flat, back slightly arched, and shoulder blades squeezed.',
    muscles: 'Chest, Shoulders, Triceps',
    link: 'https://www.strengthlog.com/bench-press/'
  },
  'push-ups': {
    instructions: 'Start in plank with hands shoulder-width apart. Lower chest to floor keeping body straight. Push back up. Modify on knees if needed.',
    muscles: 'Chest, Shoulders, Triceps, Core',
    link: 'https://www.strengthlog.com/push-up/'
  },
  'dumbbell chest press': {
    instructions: 'Lie on bench holding dumbbells at chest level. Press weights up until arms are extended. Lower with control.',
    muscles: 'Chest, Shoulders, Triceps',
    link: 'https://www.muscleandstrength.com/exercises/dumbbell-bench-press.html'
  },
  'incline bench press': {
    instructions: 'Set bench to 30-45 degrees. Press bar from upper chest to lockout. Great for upper chest development.',
    muscles: 'Upper Chest, Shoulders, Triceps',
    link: 'https://www.strengthlog.com/incline-bench-press/'
  },
  'chest fly': {
    instructions: 'Lie on bench with dumbbells above chest, slight bend in elbows. Lower arms out to sides in arc motion. Squeeze chest to bring back up.',
    muscles: 'Chest',
    link: 'https://www.strengthlog.com/dumbbell-chest-fly/'
  },
  'dips': {
    instructions: 'Grip parallel bars, lower body by bending elbows until upper arms are parallel to ground. Push back up to start.',
    muscles: 'Chest, Triceps, Shoulders',
    link: 'https://www.strengthlog.com/bar-dip/'
  },

  // === BACK EXERCISES ===
  'pull-ups': {
    instructions: 'Hang from bar with overhand grip, hands wider than shoulders. Pull up until chin clears bar. Lower with control.',
    muscles: 'Lats, Biceps, Upper Back',
    link: 'https://www.strengthlog.com/pull-up/'
  },
  'lat pulldown': {
    instructions: 'Sit at machine, grip bar wide. Pull down to upper chest while squeezing shoulder blades. Control the return.',
    muscles: 'Lats, Biceps, Rear Delts',
    link: 'https://www.strengthlog.com/lat-pulldown-with-pronated-grip/'
  },
  'barbell row': {
    instructions: 'Bend at hips holding barbell, back flat. Pull bar to lower chest, squeezing shoulder blades. Lower with control.',
    muscles: 'Upper Back, Lats, Biceps',
    link: 'https://www.strengthlog.com/barbell-row/'
  },
  'dumbbell row': {
    instructions: 'Place one hand and knee on bench. Pull dumbbell to hip, elbow close to body. Squeeze back at top.',
    muscles: 'Lats, Upper Back, Biceps',
    link: 'https://www.muscleandstrength.com/exercises/one-arm-dumbbell-row.html'
  },
  'deadlift': {
    instructions: 'Stand with feet hip-width, bar over mid-foot. Hinge at hips, grip bar. Drive through heels, keeping back flat, to stand.',
    muscles: 'Lower Back, Glutes, Hamstrings, Traps',
    link: 'https://www.strengthlog.com/deadlift/'
  },
  'seated cable row': {
    instructions: 'Sit at cable machine, feet on platform. Pull handle to midsection, squeezing shoulder blades. Extend arms with control.',
    muscles: 'Middle Back, Lats, Biceps',
    link: 'https://www.strengthlog.com/cable-close-grip-seated-row/'
  },

  // === SHOULDER EXERCISES ===
  'overhead press': {
    instructions: 'Stand holding bar at shoulders. Press overhead until arms are locked out. Lower with control.',
    muscles: 'Shoulders, Triceps, Upper Chest',
    link: 'https://www.strengthlog.com/overhead-press/'
  },
  'shoulder press': {
    instructions: 'Sit or stand with dumbbells at shoulder height. Press up until arms extended. Lower with control.',
    muscles: 'Shoulders, Triceps',
    link: 'https://www.strengthlog.com/dumbbell-shoulder-press/'
  },
  'lateral raise': {
    instructions: 'Stand with dumbbells at sides. Raise arms out to sides until parallel to floor. Lower slowly.',
    muscles: 'Side Delts',
    link: 'https://www.muscleandstrength.com/exercises/dumbbell-lateral-raise.html'
  },
  'front raise': {
    instructions: 'Hold dumbbells in front of thighs. Raise one or both arms forward to shoulder height. Lower with control.',
    muscles: 'Front Delts',
    link: 'https://www.strengthlog.com/dumbbell-front-raise/'
  },
  'face pull': {
    instructions: 'Set cable at face height. Pull rope to face, separating ends and squeezing rear delts. Great for shoulder health.',
    muscles: 'Rear Delts, Upper Back',
    link: 'https://www.strengthlog.com/face-pull/'
  },

  // === ARM EXERCISES ===
  'bicep curl': {
    instructions: 'Stand holding dumbbells, palms up. Curl weights to shoulders keeping elbows stationary. Lower with control.',
    muscles: 'Biceps',
    link: 'https://www.strengthlog.com/dumbbell-curl/'
  },
  'hammer curl': {
    instructions: 'Hold dumbbells with palms facing each other. Curl to shoulders. Works biceps and forearms.',
    muscles: 'Biceps, Forearms',
    link: 'https://www.strengthlog.com/hammer-curl/'
  },
  'tricep pushdown': {
    instructions: 'At cable machine, push bar down until arms straight. Keep elbows at sides throughout movement.',
    muscles: 'Triceps',
    link: 'https://www.strengthlog.com/tricep-pushdown-with-bar/'
  },
  'skull crusher': {
    instructions: 'Lie on bench holding bar above chest. Lower to forehead by bending elbows. Extend back up.',
    muscles: 'Triceps',
    link: 'https://www.strengthlog.com/barbell-lying-triceps-extension/'
  },
  'tricep dips': {
    instructions: 'Hands on bench behind you, lower body by bending elbows to 90 degrees. Push back up.',
    muscles: 'Triceps, Chest, Shoulders',
    link: 'https://www.strengthlog.com/bench-dip/'
  },

  // === LEG EXERCISES ===
  'squat': {
    instructions: 'Stand with feet shoulder-width. Lower by pushing hips back, knees tracking over toes. Drive through heels to stand.',
    muscles: 'Quads, Glutes, Hamstrings',
    link: 'https://www.strengthlog.com/squat/'
  },
  'squats': {
    instructions: 'Stand with feet shoulder-width. Lower by pushing hips back, knees tracking over toes. Drive through heels to stand.',
    muscles: 'Quads, Glutes, Hamstrings',
    link: 'https://www.strengthlog.com/squat/'
  },
  'leg press': {
    instructions: 'Sit in machine, feet shoulder-width on platform. Lower weight by bending knees. Press back up without locking knees.',
    muscles: 'Quads, Glutes, Hamstrings',
    link: 'https://www.strengthlog.com/leg-press/'
  },
  'lunges': {
    instructions: 'Step forward, lowering until both knees at 90 degrees. Push through front heel to return. Alternate legs.',
    muscles: 'Quads, Glutes, Hamstrings',
    link: 'https://www.strengthlog.com/barbell-lunge/'
  },
  'leg extension': {
    instructions: 'Sit in machine, extend legs until straight. Squeeze quads at top. Lower with control.',
    muscles: 'Quadriceps',
    link: 'https://www.strengthlog.com/leg-extension/'
  },
  'leg curl': {
    instructions: 'Lie face down, curl weight by bending knees. Squeeze hamstrings at top. Lower with control.',
    muscles: 'Hamstrings',
    link: 'https://www.strengthlog.com/lying-leg-curl/'
  },
  'calf raise': {
    instructions: 'Stand on edge of step. Rise up on toes as high as possible. Lower heels below step level.',
    muscles: 'Calves',
    link: 'https://www.strengthlog.com/standing-calf-raise/'
  },
  'hip thrust': {
    instructions: 'Upper back on bench, barbell on hips. Drive hips up, squeezing glutes at top. Lower with control.',
    muscles: 'Glutes, Hamstrings',
    link: 'https://www.strengthlog.com/hip-thrust/'
  },
  'romanian deadlift': {
    instructions: 'Hold bar at hips, slight knee bend. Hinge at hips, lowering bar along legs. Feel hamstring stretch, then drive hips forward.',
    muscles: 'Hamstrings, Glutes, Lower Back',
    link: 'https://www.strengthlog.com/romanian-deadlift/'
  },
  'bulgarian split squat': {
    instructions: 'Rear foot on bench behind you. Lower until front thigh parallel to ground. Drive through front heel to stand.',
    muscles: 'Quads, Glutes',
    link: 'https://www.strengthlog.com/bulgarian-split-squat/'
  },

  // === CORE EXERCISES ===
  'plank': {
    instructions: 'Hold push-up position on forearms. Keep body straight from head to heels. Engage core and hold.',
    muscles: 'Core, Shoulders',
    link: 'https://www.strengthlog.com/plank/'
  },
  'crunch': {
    instructions: 'Lie on back, knees bent. Curl shoulders off floor by contracting abs. Lower with control.',
    muscles: 'Abs',
    link: 'https://www.strengthlog.com/crunch/'
  },
  'russian twist': {
    instructions: 'Sit with knees bent, lean back slightly. Rotate torso side to side, touching weight to floor each side.',
    muscles: 'Obliques, Abs',
    link: 'https://www.muscleandstrength.com/exercises/russian-twist.html'
  },
  'leg raise': {
    instructions: 'Lie on back, legs straight. Lift legs to 90 degrees keeping lower back pressed to floor. Lower slowly.',
    muscles: 'Lower Abs',
    link: 'https://www.strengthlog.com/lying-leg-raise/'
  },
  'mountain climber': {
    instructions: 'Start in push-up position. Drive knees to chest alternately in running motion. Keep hips low.',
    muscles: 'Core, Hip Flexors',
    link: 'https://www.strengthlog.com/mountain-climbers/'
  },
  'dead bug': {
    instructions: 'Lie on back, arms up, knees bent 90°. Lower opposite arm and leg toward floor. Return and switch.',
    muscles: 'Core, Hip Flexors',
    link: 'https://www.strengthlog.com/dead-bugs/'
  },
  'bicycle crunch': {
    instructions: 'Lie on back, hands behind head. Bring opposite elbow to knee while extending other leg. Alternate sides.',
    muscles: 'Abs, Obliques',
    link: 'https://www.strengthlog.com/bicycle-crunch/'
  },
  'hanging leg raise': {
    instructions: 'Hang from bar, raise legs until parallel to ground or higher. Lower with control. Avoid swinging.',
    muscles: 'Lower Abs, Hip Flexors',
    link: 'https://www.strengthlog.com/hanging-leg-raise/'
  },

  // === YOGA POSES ===
  'downward facing dog': {
    instructions: 'Start on all fours. Lift hips up and back, forming an inverted V. Keep weight in legs, heels reaching toward floor. Hands shoulder-width apart, fingers spread wide.',
    muscles: 'Shoulders, Hamstrings, Calves, Arms',
    link: 'https://www.pocketyoga.com/pose/downward-facing-dog'
  },
  'downward dog': {
    instructions: 'Start on all fours. Lift hips up and back, forming an inverted V. Keep weight in legs, heels reaching toward floor. Hands shoulder-width apart, fingers spread wide.',
    muscles: 'Shoulders, Hamstrings, Calves, Arms',
    link: 'https://www.pocketyoga.com/pose/downward-facing-dog'
  },
  'upward facing dog': {
    instructions: 'Lie face down, hands beside ribs. Press into hands to lift chest and thighs off floor. Roll shoulders back, gaze slightly upward. Tops of feet press down.',
    muscles: 'Chest, Shoulders, Core, Back',
    link: 'https://www.pocketyoga.com/pose/upward-facing-dog'
  },
  'warrior i': {
    instructions: 'Step one foot back, front knee bent over ankle. Square hips forward. Raise arms overhead, palms facing. Back heel can lift or angle down.',
    muscles: 'Legs, Hips, Core, Shoulders',
    link: 'https://www.pocketyoga.com/pose/warrior-1'
  },
  'warrior 1': {
    instructions: 'Step one foot back, front knee bent over ankle. Square hips forward. Raise arms overhead, palms facing. Back heel can lift or angle down.',
    muscles: 'Legs, Hips, Core, Shoulders',
    link: 'https://www.pocketyoga.com/pose/warrior-1'
  },
  'warrior ii': {
    instructions: 'Wide stance, front knee bent over ankle. Arms extend parallel to floor. Gaze over front fingertips. Hips and shoulders open to side of mat.',
    muscles: 'Legs, Hips, Arms, Core',
    link: 'https://www.pocketyoga.com/pose/warrior-2'
  },
  'warrior 2': {
    instructions: 'Wide stance, front knee bent over ankle. Arms extend parallel to floor. Gaze over front fingertips. Hips and shoulders open to side of mat.',
    muscles: 'Legs, Hips, Arms, Core',
    link: 'https://www.pocketyoga.com/pose/warrior-2'
  },
  'warrior iii': {
    instructions: 'Balance on one leg, extend other leg back parallel to floor. Arms reach forward or alongside body. Keep hips level. Engage standing leg and core.',
    muscles: 'Legs, Glutes, Core, Back',
    link: 'https://www.pocketyoga.com/pose/warrior-3'
  },
  'tree pose': {
    instructions: 'Stand on one leg, place other foot on inner thigh or calf (never on knee). Hands at heart or overhead. Find a focal point for balance. Root down through standing foot.',
    muscles: 'Legs, Core, Hip Stabilizers',
    link: 'https://www.pocketyoga.com/pose/tree'
  },
  'child\'s pose': {
    instructions: 'Kneel and sit back on heels. Fold forward, arms extended or by sides. Forehead rests on mat. Breathe deeply into back body. A restful pose for recovery.',
    muscles: 'Back, Hips, Thighs, Ankles',
    link: 'https://www.pocketyoga.com/pose/childs'
  },
  'childs pose': {
    instructions: 'Kneel and sit back on heels. Fold forward, arms extended or by sides. Forehead rests on mat. Breathe deeply into back body. A restful pose for recovery.',
    muscles: 'Back, Hips, Thighs, Ankles',
    link: 'https://www.pocketyoga.com/pose/childs'
  },
  'cobra pose': {
    instructions: 'Lie face down, hands under shoulders. Press up lifting chest, keeping hips on floor. Roll shoulders back, elbows slightly bent. Gentle backbend for beginners.',
    muscles: 'Spine, Chest, Shoulders, Core',
    link: 'https://www.pocketyoga.com/pose/cobra'
  },
  'cobra': {
    instructions: 'Lie face down, hands under shoulders. Press up lifting chest, keeping hips on floor. Roll shoulders back, elbows slightly bent. Gentle backbend for beginners.',
    muscles: 'Spine, Chest, Shoulders, Core',
    link: 'https://www.pocketyoga.com/pose/cobra'
  },
  'cat-cow': {
    instructions: 'On all fours, alternate between arching back (cow: belly drops, head up) and rounding spine (cat: back lifts, chin to chest). Move with breath.',
    muscles: 'Spine, Core, Back, Neck',
    link: 'https://www.pocketyoga.com/pose/cat'
  },
  'cat cow': {
    instructions: 'On all fours, alternate between arching back (cow: belly drops, head up) and rounding spine (cat: back lifts, chin to chest). Move with breath.',
    muscles: 'Spine, Core, Back, Neck',
    link: 'https://www.pocketyoga.com/pose/cat'
  },
  'mountain pose': {
    instructions: 'Stand tall, feet hip-width apart. Ground through all four corners of feet. Engage thighs, lengthen spine. Arms at sides, palms forward. Foundation for all standing poses.',
    muscles: 'Full Body Alignment',
    link: 'https://www.pocketyoga.com/pose/mountain'
  },
  'triangle pose': {
    instructions: 'Wide stance, front foot forward. Extend torso over front leg, bottom hand to shin/floor/block. Top arm reaches up. Stack shoulders, open chest to ceiling.',
    muscles: 'Legs, Hips, Core, Shoulders',
    link: 'https://www.pocketyoga.com/pose/triangle'
  },
  'bridge pose': {
    instructions: 'Lie on back, knees bent, feet hip-width. Press feet down, lift hips. Interlace fingers under back. Chest lifts toward chin. Keep neck relaxed.',
    muscles: 'Glutes, Legs, Spine, Chest',
    link: 'https://www.pocketyoga.com/pose/bridge'
  },
  'corpse pose': {
    instructions: 'Lie on back, legs extended, arms by sides palms up. Close eyes. Release all tension. Focus on breath. Allow complete relaxation for 5-10 minutes.',
    muscles: 'Full Body Relaxation',
    link: 'https://www.pocketyoga.com/pose/corpse'
  },
  'savasana': {
    instructions: 'Lie on back, legs extended, arms by sides palms up. Close eyes. Release all tension. Focus on breath. Allow complete relaxation for 5-10 minutes.',
    muscles: 'Full Body Relaxation',
    link: 'https://www.pocketyoga.com/pose/corpse'
  },
  'sun salutation': {
    instructions: 'Flow sequence: Mountain → Hands up → Forward fold → Half lift → Plank → Low push-up → Upward dog → Downward dog → Step forward → Forward fold → Hands up → Mountain. Repeat.',
    muscles: 'Full Body',
    link: 'https://www.pocketyoga.com/pose/sun-salutation'
  },
  'forward fold': {
    instructions: 'Stand, hinge at hips and fold forward. Let head hang heavy. Slight bend in knees is fine. Hands can rest on shins, floor, or hold opposite elbows.',
    muscles: 'Hamstrings, Lower Back, Calves',
    link: 'https://www.pocketyoga.com/pose/forward-fold'
  },
  'pigeon pose': {
    instructions: 'From down dog, bring one knee behind same wrist, shin angled. Extend back leg straight. Square hips. Fold forward over front leg for deep hip stretch.',
    muscles: 'Hips, Glutes, Hip Flexors',
    link: 'https://www.pocketyoga.com/pose/pigeon'
  },
  'seated forward fold': {
    instructions: 'Sit with legs extended. Inhale lengthen spine, exhale fold forward from hips. Reach for feet or shins. Keep back as flat as possible. Breathe deeply.',
    muscles: 'Hamstrings, Lower Back, Spine',
    link: 'https://www.pocketyoga.com/pose/seated-forward-fold'
  },
  'half moon pose': {
    instructions: 'From triangle, shift weight to front foot. Lift back leg parallel to floor. Bottom hand on block/floor. Top arm reaches up. Stack hips and shoulders.',
    muscles: 'Legs, Core, Balance, Hips',
    link: 'https://www.pocketyoga.com/pose/half-moon'
  },
  'full moon': {
    instructions: 'Stand tall, interlace fingers overhead. Press palms to ceiling and lean to one side in a crescent shape. Hold, then switch sides. Opens side body and stretches lats.',
    muscles: 'Side Body, Lats, Shoulders, Core',
    link: 'https://www.pocketyoga.com/pose/crescent-moon'
  },
  'crescent moon': {
    instructions: 'Stand tall, interlace fingers overhead. Press palms to ceiling and lean to one side in a crescent shape. Hold, then switch sides. Opens side body.',
    muscles: 'Side Body, Lats, Shoulders',
    link: 'https://www.pocketyoga.com/pose/crescent-moon'
  },
  'crescent lunge': {
    instructions: 'From lunge, raise arms overhead. Back heel lifts, front knee over ankle. Sink hips while lifting through fingertips. Engage core for balance.',
    muscles: 'Legs, Hips, Core, Shoulders',
    link: 'https://www.pocketyoga.com/pose/crescent-lunge'
  },
  'hug knees to chest': {
    instructions: 'Lie on back. Draw both knees to chest, wrap arms around shins. Gently rock side to side to massage lower back. Relaxes spine and releases tension.',
    muscles: 'Lower Back, Hips, Spine',
    link: 'https://www.pocketyoga.com/pose/knees-to-chest'
  },
  'knees to chest': {
    instructions: 'Lie on back. Draw both knees to chest, wrap arms around shins. Gently rock side to side to massage lower back. Relaxes spine and releases tension.',
    muscles: 'Lower Back, Hips, Spine',
    link: 'https://www.pocketyoga.com/pose/knees-to-chest'
  },
  'happy baby': {
    instructions: 'Lie on back. Draw knees wide toward armpits, hold outer feet. Keep lower back pressed down. Gently rock side to side. Opens hips and releases lower back.',
    muscles: 'Hips, Inner Thighs, Lower Back',
    link: 'https://www.pocketyoga.com/pose/happy-baby'
  },
  'supine twist': {
    instructions: 'Lie on back. Draw one knee to chest, then across body to opposite side. Extend arm and gaze opposite direction. Hold, breathe, then switch sides.',
    muscles: 'Spine, Obliques, Hips, Back',
    link: 'https://www.pocketyoga.com/pose/supine-twist'
  },
  'spinal twist': {
    instructions: 'Lie on back. Draw one knee to chest, then across body to opposite side. Extend arm and gaze opposite direction. Hold, breathe, then switch sides.',
    muscles: 'Spine, Obliques, Hips, Back',
    link: 'https://www.pocketyoga.com/pose/supine-twist'
  },
  'seated twist': {
    instructions: 'Sit tall, one leg extended. Bend other knee, foot outside opposite thigh. Twist toward bent knee, opposite elbow outside knee. Lengthen spine with each breath.',
    muscles: 'Spine, Obliques, Hips',
    link: 'https://www.pocketyoga.com/pose/half-lord-of-the-fishes'
  },
  'chair pose': {
    instructions: 'Stand, sit hips back like sitting in chair. Knees over ankles, thighs working toward parallel. Arms reach overhead. Weight in heels, chest lifted.',
    muscles: 'Quads, Glutes, Core, Shoulders',
    link: 'https://www.pocketyoga.com/pose/chair'
  },
  'boat pose': {
    instructions: 'Sit, lean back slightly. Lift legs to 45 degrees, arms parallel to floor. Balance on sit bones. V-shape with body. Keep chest lifted, core engaged.',
    muscles: 'Core, Hip Flexors, Spine',
    link: 'https://www.pocketyoga.com/pose/boat'
  },
  'locust pose': {
    instructions: 'Lie face down, arms by sides. Lift chest, arms and legs off floor simultaneously. Gaze slightly forward. Squeeze glutes and back muscles. Hold and breathe.',
    muscles: 'Back, Glutes, Shoulders',
    link: 'https://www.pocketyoga.com/pose/locust'
  },
  'bow pose': {
    instructions: 'Lie face down, bend knees. Reach back to hold ankles. Press feet into hands, lift thighs and chest. Rock gently. Deep backbend that opens chest and shoulders.',
    muscles: 'Back, Chest, Shoulders, Quads',
    link: 'https://www.pocketyoga.com/pose/bow'
  },
  'camel pose': {
    instructions: 'Kneel, tuck toes or point feet. Hands on lower back. Lift chest and lean back, reaching for heels. Keep hips over knees. Open chest to ceiling.',
    muscles: 'Chest, Shoulders, Hip Flexors, Spine',
    link: 'https://www.pocketyoga.com/pose/camel'
  },
  'dolphin pose': {
    instructions: 'Like downward dog but on forearms. Forearms parallel, shoulders over elbows. Walk feet in closer to deepen shoulder stretch. Prepares for headstand.',
    muscles: 'Shoulders, Core, Hamstrings',
    link: 'https://www.pocketyoga.com/pose/dolphin'
  },
  'eagle pose': {
    instructions: 'Stand on one leg, wrap other leg around. Cross arms at elbows and wrists. Sink hips like chair pose. Find focal point for balance. Unwrap and switch sides.',
    muscles: 'Legs, Balance, Shoulders, Hips',
    link: 'https://www.pocketyoga.com/pose/eagle'
  },
  'extended side angle': {
    instructions: 'From warrior II, tilt torso over front leg. Bottom hand to floor/block, top arm extends over ear. Create one line from back foot through fingertips.',
    muscles: 'Legs, Obliques, Shoulders, Hips',
    link: 'https://www.pocketyoga.com/pose/extended-side-angle'
  },
  'garland pose': {
    instructions: 'Squat with feet slightly wider than hips. Keep heels down if possible. Press elbows against inner knees, palms together. Lengthen spine, open hips.',
    muscles: 'Hips, Groin, Ankles, Core',
    link: 'https://www.pocketyoga.com/pose/garland'
  },
  'malasana': {
    instructions: 'Squat with feet slightly wider than hips. Keep heels down if possible. Press elbows against inner knees, palms together. Lengthen spine, open hips.',
    muscles: 'Hips, Groin, Ankles, Core',
    link: 'https://www.pocketyoga.com/pose/garland'
  },
  'half pigeon': {
    instructions: 'From down dog, bring one knee behind same wrist. Extend back leg. Square hips. Stay upright or fold forward. Deep hip opener for glutes and piriformis.',
    muscles: 'Hips, Glutes, Hip Flexors',
    link: 'https://www.pocketyoga.com/pose/pigeon'
  },
  'legs up the wall': {
    instructions: 'Sit sideways next to wall. Swing legs up wall as you lie back. Scoot hips close to wall. Arms relaxed by sides. Restorative inversion for recovery.',
    muscles: 'Relaxation, Circulation, Hamstrings',
    link: 'https://www.pocketyoga.com/pose/legs-up-the-wall'
  },
  'reclined bound angle': {
    instructions: 'Lie on back, soles of feet together, knees fall open. Arms relaxed by sides or overhead. Let gravity open hips. Use pillows under knees if needed.',
    muscles: 'Hips, Inner Thighs, Chest',
    link: 'https://www.pocketyoga.com/pose/reclined-bound-angle'
  },
  'reverse warrior': {
    instructions: 'From warrior II, flip front palm up. Reach front arm up and back, back hand slides down back leg. Open side body. Gaze up to front hand.',
    muscles: 'Side Body, Legs, Core',
    link: 'https://www.pocketyoga.com/pose/reverse-warrior'
  },
  'side plank': {
    instructions: 'From plank, shift to one hand and outer edge of foot. Stack hips and shoulders. Reach top arm to ceiling. Engage obliques. Modify with bottom knee down.',
    muscles: 'Core, Obliques, Shoulders, Arms',
    link: 'https://www.pocketyoga.com/pose/side-plank'
  },
  'standing split': {
    instructions: 'From forward fold, lift one leg high behind you. Keep hips level. Hands on floor or hold standing ankle. Focus on extending through lifted leg.',
    muscles: 'Hamstrings, Balance, Hip Flexors',
    link: 'https://www.pocketyoga.com/pose/standing-split'
  },
  'thread the needle': {
    instructions: 'On all fours, slide one arm under body, lower shoulder and head to mat. Other arm can extend forward or wrap behind back. Opens shoulders and upper back.',
    muscles: 'Shoulders, Upper Back, Spine',
    link: 'https://www.pocketyoga.com/pose/thread-the-needle'
  },
  'wide-legged forward fold': {
    instructions: 'Stand with legs wide apart. Fold forward from hips, hands to floor or hold ankles. Let head hang. Walk hands back between legs for deeper stretch.',
    muscles: 'Hamstrings, Inner Thighs, Back',
    link: 'https://www.pocketyoga.com/pose/wide-legged-forward-fold'
  },
  'lizard pose': {
    instructions: 'From low lunge, bring both hands inside front foot. Option to lower to forearms for deeper stretch. Opens hips and hip flexors intensely.',
    muscles: 'Hip Flexors, Hips, Hamstrings',
    link: 'https://www.pocketyoga.com/pose/lizard'
  },
  'puppy pose': {
    instructions: 'From all fours, walk hands forward, keeping hips over knees. Lower chest and forehead to mat. Arms extended. Opens chest and shoulders, stretches spine.',
    muscles: 'Shoulders, Spine, Chest',
    link: 'https://www.pocketyoga.com/pose/puppy'
  },
  'low lunge': {
    instructions: 'Step one foot forward into lunge, back knee down. Front knee over ankle. Hands on floor or raise overhead. Sink hips to stretch hip flexors.',
    muscles: 'Hip Flexors, Quads, Hips',
    link: 'https://www.pocketyoga.com/pose/low-lunge'
  },
  'high lunge': {
    instructions: 'Step one foot back, front knee bent 90 degrees. Back leg straight, heel lifted. Arms reach overhead. Engage core, sink low for strength and stretch.',
    muscles: 'Legs, Hip Flexors, Core',
    link: 'https://www.pocketyoga.com/pose/high-lunge'
  },
  'sphinx pose': {
    instructions: 'Lie face down, forearms on mat with elbows under shoulders. Press forearms down to lift chest. Keep hips grounded. Gentle backbend for spine mobility.',
    muscles: 'Spine, Core, Chest',
    link: 'https://www.pocketyoga.com/pose/sphinx'
  },
  'fish pose': {
    instructions: 'Lie on back, place hands under hips. Press forearms down, lift chest and arch back. Crown of head can touch mat. Opens chest and throat.',
    muscles: 'Chest, Throat, Spine',
    link: 'https://www.pocketyoga.com/pose/fish'
  },
  'plow pose': {
    instructions: 'From shoulder stand, lower feet behind head to floor. Arms extend along mat. Keep weight on shoulders, not neck. Opens back and stretches spine.',
    muscles: 'Spine, Shoulders, Hamstrings',
    link: 'https://www.pocketyoga.com/pose/plow'
  },
  'shoulder stand': {
    instructions: 'Lie on back, lift legs and hips up. Support lower back with hands. Legs extend straight up. Weight on shoulders and upper arms, not neck.',
    muscles: 'Core, Shoulders, Back',
    link: 'https://www.pocketyoga.com/pose/shoulder-stand'
  },
  'headstand': {
    instructions: 'Forearms on mat, interlace fingers. Crown of head on mat in hands. Lift legs up. Engage core, press through forearms. Build up time gradually.',
    muscles: 'Core, Shoulders, Arms, Balance',
    link: 'https://www.pocketyoga.com/pose/headstand'
  },
  'crow pose': {
    instructions: 'Squat, place hands on floor shoulder-width. Knees rest on backs of upper arms. Lean forward, lift feet off floor. Gaze slightly forward, not down.',
    muscles: 'Arms, Core, Wrists, Balance',
    link: 'https://www.pocketyoga.com/pose/crow'
  }
};

// Categories that should show example exercises instead of instructions
const exerciseCategories = {
  'balance exercises': {
    description: 'Exercises that improve stability and coordination',
    examples: ['Single-leg stands', 'Bosu ball squats', 'Yoga tree pose', 'Single-leg deadlift', 'Balance board exercises'],
    muscles: 'Core, Stabilizers, Legs'
  },
  'balance': {
    description: 'Exercises that improve stability and coordination',
    examples: ['Single-leg stands', 'Bosu ball squats', 'Yoga tree pose', 'Single-leg deadlift', 'Balance board exercises'],
    muscles: 'Core, Stabilizers, Legs'
  },
  'stretching': {
    description: 'Hold each stretch 20-30 seconds. Breathe deeply and never bounce.',
    examples: ['Hamstring stretch', 'Quad stretch', 'Hip flexor stretch', 'Shoulder stretch', 'Chest doorway stretch', 'Cat-cow stretch'],
    muscles: 'Full Body Flexibility'
  },
  'flexibility': {
    description: 'Improve range of motion and reduce injury risk',
    examples: ['Forward fold', 'Pigeon pose', 'Butterfly stretch', 'Seated spinal twist', 'Tricep stretch'],
    muscles: 'Full Body'
  },
  'cardio': {
    description: 'Elevate heart rate for 20-60 minutes. Start slow and build intensity.',
    examples: ['Brisk walking', 'Jogging', 'Cycling', 'Swimming', 'Jump rope', 'Stair climbing'],
    muscles: 'Heart, Lungs, Legs'
  },
  'hiit': {
    description: 'High-intensity intervals followed by rest. Work hard for 20-40 seconds, rest 10-20 seconds.',
    examples: ['Burpees', 'Jump squats', 'Mountain climbers', 'High knees', 'Box jumps', 'Sprints'],
    muscles: 'Full Body, Cardiovascular'
  },
  'yoga': {
    description: 'Focus on breath, alignment, and mindful movement',
    examples: ['Sun salutation', 'Warrior poses', 'Downward dog', 'Child\'s pose', 'Cobra pose', 'Tree pose'],
    muscles: 'Full Body, Mind-Body'
  },
  'mobility': {
    description: 'Improve joint range of motion and movement quality',
    examples: ['Hip circles', 'Arm circles', 'Ankle rotations', 'Thoracic rotations', 'World\'s greatest stretch'],
    muscles: 'Joints, Connective Tissue'
  },
  'core work': {
    description: 'Strengthen the muscles that stabilize your spine',
    examples: ['Planks', 'Dead bugs', 'Bird dogs', 'Pallof press', 'Ab wheel rollouts'],
    muscles: 'Abs, Obliques, Lower Back'
  },
  'upper body': {
    description: 'Compound and isolation exercises for arms, chest, back, and shoulders',
    examples: ['Push-ups', 'Pull-ups', 'Rows', 'Shoulder press', 'Bicep curls', 'Tricep dips'],
    muscles: 'Chest, Back, Shoulders, Arms'
  },
  'lower body': {
    description: 'Build strength in your legs and glutes',
    examples: ['Squats', 'Lunges', 'Deadlifts', 'Leg press', 'Calf raises', 'Hip thrusts'],
    muscles: 'Quads, Hamstrings, Glutes, Calves'
  },
  'full body': {
    description: 'Work all major muscle groups in one session',
    examples: ['Squats', 'Deadlifts', 'Bench press', 'Rows', 'Overhead press', 'Pull-ups'],
    muscles: 'All Major Muscle Groups'
  },
  'warmup': {
    description: '5-10 minutes of light activity to prepare your body for exercise',
    examples: ['Light jogging', 'Jumping jacks', 'Arm circles', 'Leg swings', 'High knees', 'Butt kicks'],
    muscles: 'Full Body Activation'
  },
  'warm up': {
    description: '5-10 minutes of light activity to prepare your body for exercise',
    examples: ['Light jogging', 'Jumping jacks', 'Arm circles', 'Leg swings', 'High knees', 'Butt kicks'],
    muscles: 'Full Body Activation'
  },
  'cooldown': {
    description: 'Lower heart rate gradually and stretch major muscle groups',
    examples: ['Walking', 'Light stretching', 'Deep breathing', 'Foam rolling', 'Static stretches'],
    muscles: 'Recovery'
  },
  'cool down': {
    description: 'Lower heart rate gradually and stretch major muscle groups',
    examples: ['Walking', 'Light stretching', 'Deep breathing', 'Foam rolling', 'Static stretches'],
    muscles: 'Recovery'
  },
  'rest': {
    description: 'Allow your body to recover. Light activity like walking is fine.',
    examples: ['Light walking', 'Gentle stretching', 'Foam rolling', 'Meditation', 'Sleep well'],
    muscles: 'Recovery & Repair'
  },
  'active recovery': {
    description: 'Low-intensity movement to promote blood flow and recovery',
    examples: ['Walking', 'Swimming', 'Light cycling', 'Yoga', 'Foam rolling'],
    muscles: 'Recovery'
  }
};

// Check if exercise is a category
const isCategory = (exercise) => {
  const lowerExercise = exercise.toLowerCase();
  for (const category of Object.keys(exerciseCategories)) {
    if (lowerExercise.includes(category) || category.includes(lowerExercise)) {
      return exerciseCategories[category];
    }
  }
  return null;
};

// Get exercise info (specific or category)
const getExerciseInfo = (exercise) => {
  const lowerExercise = exercise.toLowerCase();
  
  // Check if it's a category first
  const category = isCategory(exercise);
  if (category) {
    return { isCategory: true, ...category };
  }
  
  // Check for specific exercise
  // Direct match
  if (exerciseDatabase[lowerExercise]) {
    return { isCategory: false, ...exerciseDatabase[lowerExercise] };
  }
  
  // Partial match
  for (const [key, info] of Object.entries(exerciseDatabase)) {
    if (lowerExercise.includes(key) || key.includes(lowerExercise.replace(/\d+\s*(sets?|reps?|minutes?|min|x)/gi, '').trim())) {
      return { isCategory: false, ...info };
    }
  }
  
  // Default for unknown exercises
  return {
    isCategory: false,
    instructions: 'Focus on proper form and controlled movements. Start with lighter weights if unsure. Breathe steadily throughout the exercise.',
    muscles: 'Target Muscles',
    link: null
  };
};

// Generate YouTube search URL
const getYouTubeSearchUrl = (exercise) => {
  const cleanExercise = exercise.replace(/\d+\s*(sets?|reps?|minutes?|min|x)/gi, '').trim();
  const searchQuery = encodeURIComponent(`how to do ${cleanExercise} exercise form tutorial`);
  return `https://www.youtube.com/results?search_query=${searchQuery}`;
};

const WeeklyPlanPageMobile = ({ user }) => {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [expandedExercise, setExpandedExercise] = useState(null);
  const navigate = useNavigate();

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  useEffect(() => {
    console.log('[WeeklyPlan] useEffect triggered, user:', user);
    
    // Add a small delay to ensure localStorage is ready after login
    const timer = setTimeout(() => {
      console.log('[WeeklyPlan] Loading weekly plan...');
      loadWeeklyPlan();
    }, 500);
    
    // Set today as selected day
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (daysOfWeek.includes(today)) {
      setSelectedDay(today);
    }
    
    return () => clearTimeout(timer);
  }, [user]);

  const loadWeeklyPlan = async () => {
    console.log('[WeeklyPlan] loadWeeklyPlan called');
    console.log('[WeeklyPlan] user:', user);
    
    if (!user || !user.email) {
      console.warn('[WeeklyPlan] No user or email, returning');
      return;
    }
    
    setIsLoading(true);
    
    // First, try to fetch from backend
    try {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('[WeeklyPlan] Fetching weekly plan from backend for:', user.email);
        
        const response = await fetch(getApiUrl(`/get-weekly-plan?user_email=${encodeURIComponent(user.email)}`), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[WeeklyPlan] Backend response:', data);
          
          if (data.success && data.weekly_plan) {
            console.log('[WeeklyPlan] Using weekly plan from backend');
            setWeeklyPlan(data.weekly_plan);
            
            // Update localStorage cache
            const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
            localStorage.setItem(userSpecificWeeklyKey, JSON.stringify(data.weekly_plan));
            
            setIsLoading(false);
            return;
          } else {
            console.log('[WeeklyPlan] No weekly plan found in backend');
          }
        } else {
          console.warn('[WeeklyPlan] Backend fetch failed with status:', response.status);
        }
      }
    } catch (error) {
      console.error('[WeeklyPlan] Error fetching from backend:', error);
    }
    
    // Fallback to localStorage if backend fails
    const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
    console.log('[WeeklyPlan] Checking localStorage with key:', userSpecificWeeklyKey);
    const savedPlan = localStorage.getItem(userSpecificWeeklyKey);
    console.log('[WeeklyPlan] LocalStorage plan found:', !!savedPlan);
    
    if (savedPlan) {
      try {
        const parsed = JSON.parse(savedPlan);
        const planDate = new Date(parsed.dateCreated);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        console.log('[WeeklyPlan] Plan date:', planDate, 'One day ago:', oneDayAgo);
        
        if (planDate > oneDayAgo) {
          console.log('[WeeklyPlan] Using existing plan from localStorage (less than 1 day old)');
          setWeeklyPlan(parsed);
          setIsLoading(false);
          return;
        } else {
          console.log('[WeeklyPlan] LocalStorage plan is more than 1 day old, clearing');
          localStorage.removeItem(userSpecificWeeklyKey);
        }
      } catch (error) {
        console.error('[WeeklyPlan] Error parsing saved weekly plan:', error);
      }
    }
    
    // If no valid plan found, try to generate from latest recommendation
    const userSpecificLatestKey = `latestFitnessRecommendation_${user.email}`;
    console.log('[WeeklyPlan] Looking for recommendation with key:', userSpecificLatestKey);
    const latestRecommendation = localStorage.getItem(userSpecificLatestKey);
    console.log('[WeeklyPlan] Latest recommendation found:', !!latestRecommendation);
    
    if (latestRecommendation) {
      try {
        const rec = JSON.parse(latestRecommendation);
        console.log('[WeeklyPlan] Parsed recommendation:', rec);
        console.log('[WeeklyPlan] Calling generateWeeklyPlanFromRecommendation...');
        await generateWeeklyPlanFromRecommendation(rec);
      } catch (error) {
        console.error('[WeeklyPlan] Error parsing latest recommendation:', error);
      }
    } else {
      console.warn('[WeeklyPlan] No recommendation found in localStorage');
      setError('No fitness recommendation found. Please generate a fitness recommendation first.');
    }
    
    setIsLoading(false);
  };

  const generateWeeklyPlanFromRecommendation = async (recommendation) => {
    console.log('[WeeklyPlan] === STARTING WEEKLY PLAN GENERATION ===');
    console.log('[WeeklyPlan] Recommendation object:', recommendation);
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const allKeys = Object.keys(localStorage);
      console.log('[WeeklyPlan] All localStorage keys:', allKeys);
      console.log('[WeeklyPlan] Token exists:', !!token);
      console.log('[WeeklyPlan] Token value:', token);
      console.log('[WeeklyPlan] Token type:', typeof token);
      console.log('[WeeklyPlan] Token length:', token ? token.length : 0);
      
      if (!token || token === 'null' || token === 'undefined') {
        setError('Authentication token not found. Please log out and log in again.');
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Parse height to inches if it's in "5'10"" format
      const userProfile = {
        ...recommendation.userProfile,
        email: user?.email
      };
      
      // Convert height to inches if it's a string
      if (userProfile.height) {
        userProfile.height = parseHeightToInches(userProfile.height);
      }
      
      console.log('[WeeklyPlan] Sending request with userProfile:', JSON.stringify(userProfile));
      console.log('[WeeklyPlan] Base recommendation length:', recommendation.recommendation?.length);
      
      const requestBody = {
        userProfile: userProfile,
        baseRecommendation: recommendation.recommendation
      };
      
      console.log('[WeeklyPlan] Full request body:', JSON.stringify(requestBody).substring(0, 500));
      console.log('[WeeklyPlan] Request URL:', getApiUrl('/generate-weekly-plan'));
      console.log('[WeeklyPlan] Authorization header:', headers['Authorization'] ? 'Bearer ' + headers['Authorization'].substring(7, 27) + '...' : 'MISSING');
      
      const response = await fetch(getApiUrl('/generate-weekly-plan'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
      });

      console.log('[WeeklyPlan] Response status:', response.status);
      console.log('[WeeklyPlan] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WeeklyPlan] Error response:', errorText);
        
        if (response.status === 401) {
          setError('Session expired. Please log out and log in again.');
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 429) {
          setError('Too many requests. Please wait a few minutes and try again.');
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        throw new Error(`Failed to generate weekly plan: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[WeeklyPlan] Received data:', data);
      
      const weeklyPlanData = {
        ...data,
        dateCreated: new Date().toISOString(),
        userProfile: recommendation.userProfile
      };
      
      setWeeklyPlan(weeklyPlanData);
      
      const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
      localStorage.setItem(userSpecificWeeklyKey, JSON.stringify(weeklyPlanData));
      
    } catch (error) {
      console.error('Error generating weekly plan:', error);
      setError(`Failed to generate weekly plan: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDayPlan = weeklyPlan?.dailyPlans?.[selectedDay];

  if (isLoading) {
    return (
      <div>
        <div className="ios-nav-bar">
          <div></div>
          <div className="ios-nav-title">Weekly Plan</div>
          <div></div>
        </div>
        <div className="ios-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="ios-spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--ios-gray)' }}>Generating your weekly plan...</p>
        </div>
      </div>
    );
  }

  if (!weeklyPlan) {
    return (
      <div>
        <div className="ios-nav-bar">
          <button className="ios-nav-button" onClick={() => navigate('/dashboard')}>
            ← Back
          </button>
          <div className="ios-nav-title">Weekly Plan</div>
          <div></div>
        </div>
        <div className="ios-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
          <h4 className="ios-card-title">No Weekly Plan Yet</h4>
          <p style={{ color: 'var(--ios-gray)', marginBottom: '20px' }}>
            Generate a fitness recommendation first to create your weekly plan.
          </p>
          <button
            className="ios-button"
            onClick={() => navigate('/fitness-advisor')}
          >
            Get Fitness Recommendation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="ios-nav-bar">
        <button className="ios-nav-button" onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        <div className="ios-nav-title">Weekly Plan</div>
        <div></div>
      </div>

      {/* Day Selector */}
      <div className="ios-segmented-control">
        {daysOfWeek.map(day => (
          <button
            key={day}
            className={`ios-segment ${selectedDay === day ? 'active' : ''}`}
            onClick={() => setSelectedDay(day)}
          >
            {day.substring(0, 3)}
          </button>
        ))}
      </div>

      {/* Selected Day Plan */}
      {selectedDayPlan ? (
        <>
          {/* Focus Area */}
          {selectedDayPlan.focus && (
            <div className="ios-card" style={{ backgroundColor: '#e3f2fd' }}>
              <div style={{ fontSize: '13px', color: 'var(--ios-gray)', marginBottom: '4px' }}>
                Focus Area
              </div>
              <div style={{ fontSize: '17px', fontWeight: '600', color: '#1976d2' }}>
                {selectedDayPlan.focus}
              </div>
            </div>
          )}

          {/* Rest Day */}
          {selectedDayPlan.isRestDay ? (
            <div className="ios-card">
              <h3 className="ios-card-title">Rest & Recovery Day</h3>
              <p style={{ color: 'var(--ios-gray)', marginBottom: '16px' }}>
                Take it easy today and focus on recovery
              </p>
              
              {selectedDayPlan.activities && selectedDayPlan.activities.length > 0 && (
                <>
                  <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>
                    Light Activities:
                  </div>
                  {selectedDayPlan.activities.map((activity, index) => (
                    <div key={index} style={{ display: 'flex', marginBottom: '8px' }}>
                      <span style={{ marginRight: '8px' }}>✓</span>
                      <span style={{ fontSize: '15px' }}>{activity}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <>
              {/* Exercises */}
              <div className="ios-section-header">Exercises</div>
              <div className="ios-list" style={{ marginBottom: '16px' }}>
                {selectedDayPlan.exercises?.map((exercise, index) => {
                  const exerciseInfo = getExerciseInfo(exercise);
                  return (
                  <div key={index} style={{ marginBottom: '1px' }}>
                    <div 
                      className="ios-list-item"
                      onClick={() => setExpandedExercise(expandedExercise === index ? null : index)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="ios-list-item-content">
                        <div className="ios-list-item-title">{exercise}</div>
                        <div style={{ 
                          fontSize: '13px', 
                          color: 'var(--ios-gray)',
                          marginTop: '2px'
                        }}>
                          {exerciseInfo.isCategory ? 'Tap for examples' : 'Tap for instructions'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IoBarbell size={24} style={{ color: '#007AFF' }} />
                        {expandedExercise === index ? (
                          <IoChevronUp size={20} style={{ color: 'var(--ios-gray)' }} />
                        ) : (
                          <IoChevronDown size={20} style={{ color: 'var(--ios-gray)' }} />
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {expandedExercise === index && (
                      <div style={{ 
                        backgroundColor: 'var(--ios-grouped-background)',
                        padding: '16px',
                        borderBottom: '1px solid var(--ios-separator)'
                      }}>
                        {exerciseInfo.isCategory ? (
                          /* Category with examples */
                          <>
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ 
                                fontSize: '14px', 
                                fontWeight: '600',
                                color: 'var(--ios-label)',
                                marginBottom: '6px'
                              }}>
                                {exerciseInfo.description}
                              </div>
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#007AFF',
                                marginBottom: '12px'
                              }}>
                                Target: {exerciseInfo.muscles}
                              </div>
                            </div>
                            
                            <div style={{ 
                              fontSize: '14px', 
                              fontWeight: '600',
                              color: 'var(--ios-label)',
                              marginBottom: '8px'
                            }}>
                              Example Exercises:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                              {exerciseInfo.examples.map((example, i) => (
                                <span key={i} style={{
                                  backgroundColor: '#E3F2FD',
                                  color: '#1976D2',
                                  padding: '6px 12px',
                                  borderRadius: '16px',
                                  fontSize: '13px',
                                  fontWeight: '500'
                                }}>
                                  {example}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          /* Specific exercise with instructions */
                          <>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'flex-start', 
                              gap: '10px',
                              marginBottom: '12px'
                            }}>
                              <IoInformationCircle size={22} color="#007AFF" style={{ flexShrink: 0, marginTop: '2px' }} />
                              <div>
                                <div style={{ 
                                  fontSize: '14px', 
                                  fontWeight: '600',
                                  color: 'var(--ios-label)',
                                  marginBottom: '6px'
                                }}>
                                  How to perform:
                                </div>
                                <p style={{ 
                                  fontSize: '14px', 
                                  color: 'var(--ios-dark-gray)',
                                  margin: 0,
                                  lineHeight: '1.5'
                                }}>
                                  {exerciseInfo.instructions}
                                </p>
                              </div>
                            </div>
                            
                            {exerciseInfo.muscles && (
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#007AFF',
                                marginBottom: '12px',
                                paddingLeft: '32px'
                              }}>
                                <strong>Muscles:</strong> {exerciseInfo.muscles}
                              </div>
                            )}
                            
                            {/* External Link */}
                            {exerciseInfo.link && (
                              <a 
                                href={exerciseInfo.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ 
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  backgroundColor: '#4CAF50',
                                  color: 'white',
                                  padding: '10px 16px',
                                  borderRadius: '10px',
                                  textDecoration: 'none',
                                  fontWeight: '600',
                                  fontSize: '14px',
                                  marginBottom: '10px'
                                }}
                              >
                                <IoLink size={18} />
                                Detailed Guide
                              </a>
                            )}
                          </>
                        )}
                        
                        {/* YouTube Button */}
                        <a 
                          href={getYouTubeSearchUrl(exercise)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            backgroundColor: '#FF0000',
                            color: 'white',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            fontWeight: '600',
                            fontSize: '15px'
                          }}
                        >
                          <IoPlay size={20} />
                          Watch Video Tutorial
                        </a>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Goals */}
              {selectedDayPlan.goals && selectedDayPlan.goals.length > 0 && (
                <>
                  <div className="ios-section-header">Today's Goals</div>
                  <div className="ios-card">
                    {selectedDayPlan.goals.map((goal, index) => (
                      <div key={index} style={{ display: 'flex', marginBottom: '8px' }}>
                        <span style={{ marginRight: '8px' }}>⭐</span>
                        <span style={{ fontSize: '15px' }}>{goal}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Notes */}
              {selectedDayPlan.notes && (
                <>
                  <div className="ios-section-header">Notes</div>
                  <div className="ios-card">
                    <p style={{ fontSize: '15px', color: 'var(--ios-dark-gray)', margin: 0 }}>
                      {selectedDayPlan.notes}
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {/* Weekly Summary */}
          <div className="ios-section-header">This Week's Summary</div>
          <div className="ios-card">
            <div style={{ fontSize: '15px', color: 'var(--ios-dark-gray)' }}>
              <p style={{ marginBottom: '8px' }}>
                <strong>Created:</strong> {new Date(weeklyPlan.dateCreated).toLocaleDateString()}
              </p>
              <p style={{ marginBottom: '8px' }}>
                <strong>Goal:</strong> {weeklyPlan.userProfile?.agentType?.replace('_', ' ') || 'General Fitness'}
              </p>
              <p style={{ marginBottom: '0' }}>
                <strong>Days Complete:</strong> Track your progress daily
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ padding: '16px 16px 80px' }}>
            <button
              className="ios-button"
              onClick={() => navigate('/fitness-advisor')}
            >
              Generate New Plan
            </button>
          </div>
        </>
      ) : (
        <div className="ios-card">
          <p style={{ color: 'var(--ios-gray)' }}>
            No plan available for {selectedDay}
          </p>
        </div>
      )}

      {error && (
        <div className="ios-card" style={{ backgroundColor: '#f8d7da' }}>
          <div style={{ color: '#721c24', fontSize: '15px' }}>
            {error}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyPlanPageMobile;
