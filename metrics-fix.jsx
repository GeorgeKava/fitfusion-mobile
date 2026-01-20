{activityLog && activityLog.length > 0 ? (
  <>
    <div className="row mb-4">
      <div className="col-md-3">
        <div className="card border-primary h-100">
          <div className="card-body text-center">
            <i className="fas fa-dumbbell fa-3x text-primary mb-3"></i>
            <h5 className="card-title">Workouts Completed</h5>
            <h3 className="display-4">{metrics.workoutsCompleted}</h3>
            <p className="card-text text-muted">
              {user && user.createdAt && new Date(user.createdAt) > new Date(Date.now() - 86400000 * 7)
                ? `since account creation (${Math.floor((new Date() - new Date(user.createdAt)) / 86400000)} days)`
                : `in the past ${selectedTimeframe === 'week' ? '7' : selectedTimeframe === 'month' ? '30' : '365'} days`
              }
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card border-info h-100">
          <div className="card-body text-center">
            <i className="fas fa-bed fa-3x text-info mb-3"></i>
            <h5 className="card-title">Rest Days Observed</h5>
            <h3 className="display-4">{metrics.restDaysObserved}</h3>
            <p className="card-text text-muted">
              important for recovery
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card border-success h-100">
          <div className="card-body text-center">
            <i className="fas fa-calendar-check fa-3x text-success mb-3"></i>
            <h5 className="card-title">Consistency Score</h5>
            <h3 className="display-4">{metrics.consistencyScore}%</h3>
            <p className="card-text text-muted">
              based on activity frequency
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card border-warning h-100">
          <div className="card-body text-center">
            <i className="fas fa-tachometer-alt fa-3x text-warning mb-3"></i>
            <h5 className="card-title">Progress Rate</h5>
            <h3 className="display-4">{metrics.progressRate}%</h3>
            <p className="card-text text-muted">
              towards your fitness goals
            </p>
          </div>
        </div>
      </div>
    </div>

    <div className="row mb-4">
      <div className="col-md-3">
        <div className="card border-danger h-100">
          <div className="card-body text-center">
            <i className="fas fa-fire-alt fa-3x text-danger mb-3"></i>
            <h5 className="card-title">Calories Burned</h5>
            <h3 className="display-4">{metrics.totalCaloriesBurned.toLocaleString()}</h3>
            <p className="card-text text-muted">
              total calories
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card border-primary h-100">
          <div className="card-body text-center">
            <i className="fas fa-shoe-prints fa-3x text-primary mb-3"></i>
            <h5 className="card-title">Steps Taken</h5>
            <h3 className="display-4">{metrics.totalSteps.toLocaleString()}</h3>
            <p className="card-text text-muted">
              total steps
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card border-info h-100">
          <div className="card-body text-center">
            <i className="fas fa-road fa-3x text-info mb-3"></i>
            <h5 className="card-title">Distance Covered</h5>
            <h3 className="display-4">{metrics.totalMiles}</h3>
            <p className="card-text text-muted">
              miles run/walked
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-3">
        <div className="card border-success h-100">
          <div className="card-body text-center">
            <i className="fas fa-smile-beam fa-3x text-success mb-3"></i>
            <h5 className="card-title">Feeling Rating</h5>
            <h3 className="display-4">{metrics.averageFeelingRating}/5</h3>
            <p className="card-text text-muted">
              average rating
            </p>
          </div>
        </div>
      </div>
    </div>
  </>
) : (
  <div className="row mb-4">
    <div className="col-12">
      <div className="card">
        <div className="card-body text-center py-5">
          <i className="fas fa-chart-line fa-3x text-muted mb-3"></i>
          <h5>No Activity Data Available</h5>
          <p className="text-muted">Start logging your workouts to see your progress metrics!</p>
        </div>
      </div>
    </div>
  </div>
)}
