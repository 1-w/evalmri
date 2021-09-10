define([], function () {
  class User {
    constructor(userid) {
      this.id = userid;
    }
    // three letter userid
    id = "-1";
    // timepoints, names of all actions
    actions = [];
    // randomised list of subjects for initial evaluation
    initial_list = [];
    // randomised list of subjects for secondary evaluation
    review_list = [];
    // list indicating which subjects from review_list should be reevaluated
    review_ids = [];
    // current position in the evaluation
    currentPosition = { list: "initial_list", index: 0 };
    // dictionary showing the results for each subject
    results = {};
    // one entry in the results dict should be:
    /*'subject_id':{
        'certainty':-100 - 100,
        'roi':[x,y,z],
        'roi_certainty':0-100,
        'revision':True/False,
        'roi_revision':[x,y,z],
        'roi_revision_certainty':0-100,
        'actions':[...]
    }
    */
  }
  return User;
});
